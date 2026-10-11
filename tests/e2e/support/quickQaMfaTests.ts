import {
	expect,
	test,
	waitForAppReady,
	signInLocalQaAccount,
} from "./browserTest";

const toolsPath = "/profile/privileged-tools";
const profilePath = "/profile";
const queuePath = "/api/moderation/food-warning-queues?queue=reports";

// Register each maintained persona alongside the tests that reset its MFA factors.
// The owning spec's default mode prevents a second worker invalidating its session.
export const registerQuickQaMfaTests = (
	personas: Array<"Moderator" | "Admin" | "Developer">,
) => {
	for (const persona of personas) {
		test(
			`Quick QA verifies ${persona} without manual MFA`,
			{ tag: "@compatibility" },
			async ({ context, page }) => {
				// Keep the fixture's TEST-only quota partition while removing its session.
				await context.clearCookies({ name: /auth-token/ });
				// Auth can legitimately wait31s for replay-safe TOTP. Keep its
				// role/session proof independent of the tools diagnostics workload.
				await page.goto(`/auth?next=${encodeURIComponent(profilePath)}`);
				await waitForAppReady(page);
				await page.getByRole("combobox", { name: "QA account" }).click();
				await page
					.getByRole("option", { name: new RegExp(`QA ${persona} ·`) })
					.click();
				await page
					.getByRole("button", { name: `Continue as QA ${persona}` })
					.click();
				await expect(page).toHaveURL((url) => url.pathname === profilePath, {
					timeout: 45_000,
				});
				const roleLink = page.getByRole("link", {
					name: new RegExp(`${persona} tools`),
				});
				await expect(roleLink).toBeVisible();
				await expect(roleLink).toHaveAttribute("href", toolsPath);
				await expect(page.getByLabel("Six-digit code")).toHaveCount(0);
				const response = await page.request.get(queuePath);
				expect(response.status()).toBe(200);
				await page.reload();
				await expect(page).toHaveURL((url) => url.pathname === profilePath);
				await expect(roleLink).toBeVisible();
				await expect(roleLink).toHaveAttribute("href", toolsPath);
				await expect(page.getByLabel("Six-digit code")).toHaveCount(0);
				const reloadedAccess = await page.request.get(queuePath);
				expect(reloadedAccess.status()).toBe(200);
			},
		);
	}
};

export const registerOrdinaryQuickQaTest = () => {
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
};

export const registerManualQaMfaTest = () => {
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
};
