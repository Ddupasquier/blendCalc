import {
	expect,
	expectCompactHeaderHidesAndRevealsWithScroll,
	expectFocusOutlineInsideBoundary,
	test,
	waitForAppReady,
} from "./support/browserTest";

const tinyPng = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
	"base64",
);

test("appearance choices use native radios and preview the selected theme", async ({
	page,
}) => {
	await page.goto("/profile");
	await waitForAppReady(page);
	await page.getByRole("button", { name: /Light\/Dark Mode/ }).click();
	await expect(page).toHaveURL(/\/profile\/appearance$/);
	await expect(page).toHaveTitle("Light/Dark Mode · blendCalc");

	const appearanceSheet = page.getByRole("dialog", { name: "Light/Dark Mode" });
	const themeGroup = appearanceSheet.getByRole("group", { name: "Color theme" });
	const deviceTheme = themeGroup.getByRole("radio", { name: /Device/ });
	const darkTheme = themeGroup.getByRole("radio", { name: /Dark/ });
	await expect(deviceTheme).toBeChecked();
	await themeGroup.getByText("Dark", { exact: true }).click();
	await expect(darkTheme).toBeChecked();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
	await themeGroup.getByText("Device", { exact: true }).click();
	await expect(deviceTheme).toBeChecked();
	await page.keyboard.press("Escape");
	await expect(page).toHaveURL(/\/profile$/);
	await expect(page).toHaveTitle("Profile · blendCalc");
});

test("profile photo selection uses the shared accessible upload control", async ({
	page,
}) => {
	await page.goto("/profile");
	await waitForAppReady(page);
	await page.getByRole("button", { name: /Profile image/ }).click();
	await expect(page).toHaveURL(/\/profile\/image$/);

	const profileImageSheet = page.getByRole("dialog", { name: "Profile image" });
	const input = profileImageSheet.locator('input[type="file"][name="avatar"]');
	await input.setInputFiles({
		name: "playwright-profile.png",
		mimeType: "image/png",
		buffer: tinyPng,
	});
	await expect(page.getByText("playwright-profile.png")).toBeVisible();
	await expect(
		profileImageSheet.getByRole("button", { name: "Clear profile photo selection" }),
	).toBeVisible();
});

test("profile selects support keyboard dismissal without changing the value", async ({
	page,
}) => {
	await page.goto("/profile");
	await waitForAppReady(page);
	await page.getByRole("button", { name: /Food preferences/ }).click();
	await expect(page).toHaveURL(/\/profile\/food-preferences$/);

	const foodPreferencesView = page.getByRole("dialog", { name: "Food preferences" });
	const region = foodPreferencesView.getByRole("combobox", {
		name: "Package-label region",
	});
	const originalLabel = (await region.innerText()).trim();
	await region.focus();
	await region.press("ArrowDown");
	await expect(region).toHaveAttribute("aria-expanded", "true");
	await region.press("Escape");
	await expect(region).toHaveAttribute("aria-expanded", "false");
	await expect(region).toBeFocused();
	await expect(region).toContainText(originalLabel);
});

test("compact Profile header leaves and returns with main-page scroll direction", async ({
	page,
}, testInfo) => {
	test.skip(
		!testInfo.project.name.startsWith("mobile-"),
		"Compact header behavior is a phone-layout contract.",
	);

	await page.goto("/profile");
	await waitForAppReady(page);
	const viewTop = page.locator(".profile-page__top");
	const profileScrollContainer = page.locator(".profile-page");

	await expectCompactHeaderHidesAndRevealsWithScroll(
		viewTop,
		profileScrollContainer,
	);

	await page.getByRole("button", { name: /Food preferences/ }).click();
	const headerWasHiddenBeforeSheetScroll = await viewTop.evaluate((element) =>
		element.classList.contains("view-top--compact-hidden"),
	);
	const foodPreferencesBody = page.locator(
		".profile-food-preference-view__body",
	);
	const sheetMaximumScrollTop = await foodPreferencesBody.evaluate((element) => {
		const nextScrollTop = element.scrollHeight - element.clientHeight;
		element.scrollTo({ top: nextScrollTop });
		return nextScrollTop;
	});
	expect(sheetMaximumScrollTop).toBeGreaterThan(0);
	await expect
		.poll(() =>
			viewTop.evaluate((element) =>
				element.classList.contains("view-top--compact-hidden"),
			),
		)
		.toBe(headerWasHiddenBeforeSheetScroll);
});

test("Profile settings use routed sheets and restore launcher focus", async ({
	page,
}) => {
	await page.goto("/profile");
	await waitForAppReady(page);

	const detailsLauncher = page.getByRole("button", { name: /Profile details/ });
	await detailsLauncher.click();
	await expect(page).toHaveURL(/\/profile\/details$/);
	const profileDetailsSheet = page.getByRole("dialog", { name: "Profile details" });
	await expect(profileDetailsSheet).toBeVisible();
	await expect(
		profileDetailsSheet.getByRole("button", { name: "Close sheet" }),
	).toBeVisible();
	await expect(
		profileDetailsSheet.getByRole("button", { name: "Back", exact: true }),
	).toHaveCount(0);
	await page.keyboard.press("Escape");
	await expect(page).toHaveURL(/\/profile$/);
	await expect(detailsLauncher).toBeFocused();

	await page.goto("/profile/food-preferences");
	await waitForAppReady(page);
	await expect(page).toHaveTitle("Food Preferences · blendCalc");
	await expect(
		page.getByRole("dialog", { name: "Food preferences" }),
	).toBeVisible();
	const foodPreferenceView = page.locator(".profile-food-preference-view");
	const backToProfileButton = page.getByRole("button", {
		name: "Back to profile",
	});
	await expectFocusOutlineInsideBoundary(
		backToProfileButton,
		foodPreferenceView,
	);
	await backToProfileButton.click();
	await expect(page).toHaveURL(/\/profile$/);
});

test("moderator actions stay hidden from regular accounts and use the shared sheet for elevated accounts", async ({
	page,
}) => {
	await page.goto("/profile");
	await waitForAppReady(page);
	await expect(
		page.getByRole("button", { name: /Moderator actions/ }),
	).toHaveCount(0);

	await page.context().clearCookies();
	await page.goto("/auth?next=/profile");
	await page.getByLabel("Email").fill("qa-moderator@blendcalc.local");
	await page.getByLabel("Password", { exact: true }).fill(
		process.env.PLAYWRIGHT_QA_PASSWORD ?? "BlendCalc-Local-QA-2026!",
	);
	await page.getByRole("button", { name: "Sign in", exact: true }).click();
	await expect(page).toHaveURL(/\/profile$/);
	await waitForAppReady(page);

	await page.getByRole("button", { name: /Moderator actions/ }).click();
	await expect(page).toHaveURL(/\/profile\/moderator-actions$/);
	const moderatorActionsSheet = page.getByRole("dialog", {
		name: "Moderator actions",
	});
	await expect(moderatorActionsSheet).toBeVisible();
	for (const actionName of [
		"Product submissions",
		"Food warning reports",
		"Profile images",
		"Account access",
		"Catalog data health",
	]) {
		await expect(
			moderatorActionsSheet.getByRole("button", { name: new RegExp(actionName) }),
		).toBeVisible();
	}

	await moderatorActionsSheet
		.getByRole("button", { name: /Account access/ })
		.click();
	await expect(page).toHaveURL(/\/moderation#account-review$/);
	await expect(
		page.getByText("Rejected public submissions: 0").first(),
	).toBeVisible();
});
