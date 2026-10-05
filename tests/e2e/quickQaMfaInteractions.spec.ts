import {
	expect,
	test,
	waitForAppReady,
	signInLocalQaAccount,
} from "./support/browserTest";

test.describe.configure({ mode: "serial" });

const toolsPath = "/profile/privileged-tools";
const queuePath = "/api/moderation/food-warning-queues?queue=reports";

for (const persona of ["Moderator", "Admin", "Developer"]) {
	test(
		`Quick QA verifies ${persona} without manual MFA`,
		{ tag: "@compatibility" },
		async ({ context, page }) => {
			// Keep the fixture's TEST-only quota partition while removing its session.
			await context.clearCookies({ name: /auth-token/ });
			await page.goto(`/auth?next=${encodeURIComponent(toolsPath)}`);
			await waitForAppReady(page);
			await page.getByRole("combobox", { name: "QA account" }).click();
			await page
				.getByRole("option", { name: new RegExp(`QA ${persona} ·`) })
				.click();
			await page
				.getByRole("button", { name: `Continue as QA ${persona}` })
				.click();
			await expect(page).toHaveURL((url) => url.pathname === toolsPath, {
				timeout: 45_000,
			});
			await expect(
				page.getByRole("heading", { name: `${persona} tools`, exact: true }),
			).toBeVisible();
			await expect(page.getByLabel("Six-digit code")).toHaveCount(0);
			const response = await page.request.get(queuePath);
			expect(response.status()).toBe(200);
			await page.reload();
			await expect(page).toHaveURL((url) => url.pathname === toolsPath);
		},
	);
}

test(
	"ordinary Quick QA accounts remain forbidden",
	{ tag: "@compatibility" },
	async ({ context, page }) => {
		await context.clearCookies({ name: /auth-token/ });
		await page.goto("/auth");
		await waitForAppReady(page);
		await page.getByRole("button", { name: "Continue as QA User" }).click();
		await expect(page).toHaveURL(/\/ingredients\/fridge$/);
		const response = await page.request.get(queuePath);
		expect(response.status()).toBe(403);
	},
);

test(
	"real credential login retains the manual MFA challenge",
	{ tag: "@compatibility" },
	async ({ page }) => {
		await signInLocalQaAccount({
			page,
			email: "qa-developer@blendcalc.local",
			nextPath: "/profile",
		});
		await page.goto(toolsPath);
		await expect(page).toHaveURL(/\/auth\/mfa\/challenge\?/);
		await expect(page.getByLabel("Six-digit code")).toBeVisible();
	},
);
