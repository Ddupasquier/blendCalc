import {
	expect,
	test,
	waitForAppReady,
	waitForVisualStability,
} from "./support/browserTest";

const stableViewSnapshots = [
	{ route: "/mix", snapshotName: "mix.png", rootSelector: ".view-frame" },
	{
		route: "/saved",
		snapshotName: "saved-recipes.png",
		rootSelector: ".view-frame",
	},
	{
		route: "/profile/food-preferences",
		snapshotName: "profile-food-preferences.png",
		rootSelector: ".profile-food-preference-view",
	},
	{
		route: "/auth/update-password?reason=recovery",
		snapshotName: "account-password-update.png",
		rootSelector: ".account-security-page-shell__card",
	},
] as const;

const guestAccessSnapshots = [
	{ route: "/", snapshotName: "guest-landing.png", theme: "light" },
	{ route: "/auth", snapshotName: "guest-authentication.png", theme: "light" },
	{
		route: "/auth",
		snapshotName: "guest-authentication-sign-in.png",
		theme: "light",
		realSignIn: true,
	},
	{ route: "/", snapshotName: "guest-landing-dark.png", theme: "dark" },
	{
		route: "/auth",
		snapshotName: "guest-authentication-dark.png",
		theme: "dark",
	},
	{
		route: "/auth",
		snapshotName: "guest-authentication-sign-in-dark.png",
		theme: "dark",
		realSignIn: true,
	},
] as const;

for (const view of stableViewSnapshots) {
	test(
		`${view.route} keeps its approved desktop and phone composition`,
		{ tag: "@mobile" },
		async ({ page }, testInfo) => {
			test.skip(
				Boolean(process.env.CI),
				"Reviewed macOS image baselines run locally; CI owns structural layout checks.",
			);
			test.skip(
				!["desktop-chromium", "mobile-chromium"].includes(
					testInfo.project.name,
				),
				"Visual baselines are intentionally limited to deterministic Chromium projects.",
			);

			await page.goto(view.route);
			await waitForVisualStability(page);

			await expect(page.locator(view.rootSelector)).toHaveScreenshot(
				view.snapshotName,
				{
					mask: [page.locator("img")],
					maskColor: "#eaf7ef",
				},
			);
		},
	);
}

for (const view of guestAccessSnapshots) {
	test(
		`${view.route} keeps the shared ${view.theme} ${
			"realSignIn" in view && view.realSignIn ? "real sign-in" : "guest access"
		} composition`,
		{ tag: "@mobile" },
		async ({ context, page }, testInfo) => {
			test.skip(
				Boolean(process.env.CI),
				"Reviewed macOS image baselines run locally; CI owns structural layout checks.",
			);
			test.skip(
				!["desktop-chromium", "mobile-chromium"].includes(
					testInfo.project.name,
				),
				"Visual baselines are intentionally limited to deterministic Chromium projects.",
			);

			await context.clearCookies();
			await context.addCookies([
				{
					name: "blendcalc-theme",
					value: view.theme,
					url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5174",
				},
			]);
			await page.goto(view.route);
			if ("realSignIn" in view && view.realSignIn) {
				await waitForAppReady(page);
				const realSignInSwitch = page.getByRole("switch", {
					name: "Test the real sign-in flow",
				});
				await realSignInSwitch.click();
				await expect(realSignInSwitch).toBeChecked();
				await expect(
					page.getByRole("heading", { name: "Welcome back." }),
				).toBeVisible();
			}
			await waitForVisualStability(page);

			await expect(
				page.locator(".guest-access-page-shell__card"),
			).toHaveScreenshot(view.snapshotName);
		},
	);
}
