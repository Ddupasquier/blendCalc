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

	const themeGroup = page.getByRole("group", { name: "Color theme" });
	const deviceTheme = themeGroup.getByRole("radio", { name: /Device/ });
	const darkTheme = themeGroup.getByRole("radio", { name: /Dark/ });
	await expect(deviceTheme).toBeChecked();
	await themeGroup.getByText("Dark", { exact: true }).click();
	await expect(darkTheme).toBeChecked();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
	await themeGroup.getByText("Device", { exact: true }).click();
	await expect(deviceTheme).toBeChecked();
});

test("profile photo selection uses the shared accessible upload control", async ({
	page,
}) => {
	await page.goto("/profile");
	await waitForAppReady(page);

	const input = page.locator('input[type="file"][name="avatar"]');
	await input.setInputFiles({
		name: "playwright-profile.png",
		mimeType: "image/png",
		buffer: tinyPng,
	});
	await expect(page.getByText("playwright-profile.png")).toBeVisible();
	await expect(page.getByRole("button", { name: "Clear profile photo selection" })).toBeVisible();
});

test("profile selects support keyboard dismissal without changing the value", async ({
	page,
}) => {
	await page.goto("/profile");
	await waitForAppReady(page);

	const region = page.getByRole("combobox", { name: "Package-label region" });
	const originalLabel = (await region.innerText()).trim();
	await region.focus();
	await region.press("ArrowDown");
	await expect(region).toHaveAttribute("aria-expanded", "true");
	await region.press("Escape");
	await expect(region).toHaveAttribute("aria-expanded", "false");
	await expect(region).toBeFocused();
	await expect(region).toContainText(originalLabel);
});
