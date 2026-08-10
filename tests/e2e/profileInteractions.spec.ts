import { expect, test, waitForAppReady } from "./support/browserTest";

const tinyPng = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
	"base64",
);

test("appearance choices use native radios and preview the selected theme", async ({
	page,
}) => {
	await page.goto("/profile");
	await waitForAppReady(page);
	await page.getByRole("button", { name: /Appearance/ }).click();
	await expect(page).toHaveURL(/\/profile\/appearance$/);
	await expect(page).toHaveTitle("Appearance · blendCalc");

	const appearanceSheet = page.getByRole("dialog", { name: "Appearance" });
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

test("Profile settings use routed sheets and restore launcher focus", async ({
	page,
}) => {
	await page.goto("/profile");
	await waitForAppReady(page);

	const detailsLauncher = page.getByRole("button", { name: /Profile details/ });
	await detailsLauncher.click();
	await expect(page).toHaveURL(/\/profile\/details$/);
	await expect(
		page.getByRole("dialog", { name: "Profile details" }),
	).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page).toHaveURL(/\/profile$/);
	await expect(detailsLauncher).toBeFocused();

	await page.goto("/profile/food-preferences");
	await waitForAppReady(page);
	await expect(page).toHaveTitle("Food Preferences · blendCalc");
	await expect(
		page.getByRole("dialog", { name: "Food preferences" }),
	).toBeVisible();
	await page.getByRole("button", { name: "Back to profile" }).click();
	await expect(page).toHaveURL(/\/profile$/);
});
