import { randomUUID } from "node:crypto";
import { expect, test, waitForAppReady } from "./support/browserTest";
import {
	createLocalQaServiceRoleDatabaseClient,
	getAuthenticatedLocalQaDatabaseClient,
} from "./support/localQaDatabase";

test("content placements respect overlays, empty results and settings @compatibility", async ({
	page,
}, testInfo) => {
	const sellers = await page.request.get("/ads.txt");
	expect(sellers.status()).toBe(200);
	expect(sellers.headers()["content-type"]).toContain("text/plain");
	expect((await sellers.text()).trim()).toBe(
		"google.com, pub-4750881749573716, DIRECT, f08c47fec0942fa0",
	);
	const requests: string[] = [];
	page.on("request", (request) => {
		if (/googlesyndication|doubleclick|fundingchoices/.test(request.url()))
			requests.push(request.url());
	});
	for (const route of [
		"/ingredients/fridge",
		"/ingredients/shopping",
		"/mix",
		"/saved",
	]) {
		await page.goto(route);
		await waitForAppReady(page);
		await expect(
			page.locator('[data-advertising-mode="preview"]'),
		).toBeVisible();
		await page.locator(".app-advertising").scrollIntoViewIfNeeded();
		await page.screenshot({
			path: testInfo.outputPath(`ads-${route.split("/").at(-1)}.png`),
		});
	}
	await page
		.getByPlaceholder("Search saved recipes…")
		.fill("QA no matching advertising result");
	await expect(page.locator(".app-advertising")).toHaveCount(0);
	for (const route of ["/saved/sort", "/profile", "/privacy"]) {
		await page.goto(route);
		await waitForAppReady(page);
		await expect(page.locator(".app-advertising")).toHaveCount(0);
	}
	expect(requests).toEqual([]);
});

test("browser refusal stops placements and cross-tab changes restore eligible previews @compatibility", async ({
	page,
	context,
}, testInfo) => {
	await page.goto("/saved");
	await waitForAppReady(page);
	await expect(page.locator(".app-advertising")).toBeVisible();
	const privacy = await context.newPage();
	await privacy.goto("/privacy");
	const block = privacy.getByRole("switch", {
		name: "Block advertising on this browser",
	});
	await expect(block).toBeEnabled();
	await block.check();
	await expect(page.locator(".app-advertising")).toHaveCount(0);
	await block.uncheck();
	await expect(page.locator(".app-advertising")).toBeVisible();
	await privacy.close();
	await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
	await page.evaluate(() => {
		document.documentElement.style.fontSize = "200%";
	});
	await page.locator(".app-advertising").scrollIntoViewIfNeeded();
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
	await expect(
		page.getByRole("complementary", { name: "Advertisement", exact: true }),
	).toBeVisible();
	await page.screenshot({ path: testInfo.outputPath("ads-dark-enlarged.png") });
});

test("server ad-free access suppresses placements and revocation restores eligibility @compatibility", async ({
	page,
}, testInfo) => {
	const authenticated = await getAuthenticatedLocalQaDatabaseClient(
		testInfo.parallelIndex,
	);
	const {
		data: { user },
		error,
	} = await authenticated.auth.getUser();
	if (error || !user) throw error ?? new Error("Missing QA user");
	const admin = await createLocalQaServiceRoleDatabaseClient();
	const original = await admin
		.from("user_ad_free_access")
		.select("*")
		.eq("user_id", user.id)
		.maybeSingle();
	if (original.error) throw original.error;
	try {
		const grant = await admin.from("user_ad_free_access").upsert({
			user_id: user.id,
			expires_at: new Date(Date.now() + 3_600_000).toISOString(),
			revoked_at: null,
		});
		if (grant.error) throw grant.error;
		await page.goto("/saved");
		await waitForAppReady(page);
		await expect(page.locator(".app-advertising")).toHaveCount(0);
		const access = await page.request.get("/api/advertising/access");
		expect(await access.json()).toEqual({ eligibility: "ad-free" });
		expect(access.headers()["cache-control"]).toBe("private, no-store");
		const revoke = await admin
			.from("user_ad_free_access")
			.update({ revoked_at: new Date().toISOString() })
			.eq("user_id", user.id);
		if (revoke.error) throw revoke.error;
		await page.reload();
		await waitForAppReady(page);
		await expect(page.locator(".app-advertising")).toBeVisible();
	} finally {
		const restored = original.data
			? await admin.from("user_ad_free_access").upsert(original.data)
			: await admin.from("user_ad_free_access").delete().eq("user_id", user.id);
		expect(restored.error).toBeNull();
	}
});

test("one completed save can reach the usage checkpoint without interrupting editing @compatibility", async ({
	page,
}, testInfo) => {
	const authenticated = await getAuthenticatedLocalQaDatabaseClient(
		testInfo.parallelIndex,
	);
	const {
		data: { user },
		error,
	} = await authenticated.auth.getUser();
	if (error || !user) throw error ?? new Error("Missing QA user");
	const admin = await createLocalQaServiceRoleDatabaseClient();
	const name = `QA Ads ${randomUUID().slice(0, 8)}`;
	await page.goto("/saved");
	await waitForAppReady(page);
	// A prior device session, followed by a real persisted save at the boundary.
	await page.evaluate(
		(userId) =>
			localStorage.setItem(
				`blendcalc-advertising-usage-v1:user:${userId}`,
				JSON.stringify({
					version: 1,
					startedAt: Date.now() - 6 * 60_000,
					completedActions: 9,
					lastBreakAt: null,
				}),
			),
		user.id,
	);
	try {
		await page.goto("/mix");
		await waitForAppReady(page);
		await page.getByRole("button", { name: "Save mix", exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "Review & Save Mix" });
		await expect(dialog).toBeVisible();
		await expect(page.locator(".app-advertising")).toHaveCount(0);
		await dialog.getByLabel("Mix name", { exact: true }).fill(name);
		await dialog
			.getByRole("button", { name: "Save Recipe", exact: true })
			.click();
		await expect(dialog).toBeHidden();
		const dismiss = page.getByRole("button", {
			name: "Dismiss advertisement",
			exact: true,
		});
		await expect(dismiss).toBeVisible();
		await dismiss.scrollIntoViewIfNeeded();
		await page.screenshot({
			path: testInfo.outputPath("ads-usage-break.png"),
			animations: "disabled",
		});
		await dismiss.click();
		await expect(page.locator(".app-advertising")).toHaveCount(0);
		await page.goto("/saved");
		await waitForAppReady(page);
		await expect(page.locator(".app-advertising")).toBeVisible();
		await expect(dismiss).toHaveCount(0);
	} finally {
		const cleanup = await admin
			.from("saved_drinks")
			.delete()
			.eq("user_id", user.id)
			.eq("name", name);
		expect(cleanup.error).toBeNull();
	}
});

test("Global Privacy Control suppresses actual content placements @compatibility", async ({
	page,
}) => {
	await page.addInitScript(() =>
		Object.defineProperty(Navigator.prototype, "globalPrivacyControl", {
			configurable: true,
			get: () => true,
		}),
	);
	await page.goto("/saved");
	await waitForAppReady(page);
	await expect(page.locator(".app-advertising")).toHaveCount(0);
	await page.goto("/privacy");
	const refusal = page.getByRole("switch", {
		name: "Block advertising on this browser",
	});
	await expect(refusal).toBeChecked();
	await expect(refusal).toBeDisabled();
});
