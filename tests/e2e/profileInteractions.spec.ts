import {
	expect,
	expectCompactHeaderHidesAndRevealsWithScroll,
	expectFocusOutlineInsideBoundary,
	test,
	waitForAppReady,
} from "./support/browserTest";
import type { Locator } from "@playwright/test";
import { getLocalQaAccountForWorker } from "./support/localQaAccounts";

const tinyPng = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
	"base64",
);

const openFoodPreferenceDisclosure = async (
	foodPreferencesView: Locator,
	title: string,
) => {
	const summary = foodPreferencesView.locator("summary").filter({ hasText: title });
	const disclosure = summary.locator("xpath=..");
	if (!await disclosure.evaluate((element) =>
		(element as HTMLDetailsElement).open)) {
		await summary.click();
	}
	return disclosure;
};

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
	await expect(
		appearanceSheet.getByRole("heading", { name: "Light/Dark Mode" }),
	).toHaveCount(1);
	await expect(themeGroup.locator("legend")).toHaveClass(/sr-only/);
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

test("playful messages persist the exact saved account preference", async ({
	page,
}) => {
	await page.goto("/profile");
	await waitForAppReady(page);
	await page.getByRole("button", { name: /Playful messages/ }).click();
	await expect(page).toHaveURL(/\/profile\/playful-messages$/);

	let sheet = page.getByRole("dialog", { name: "Playful messages" });
	let preference = sheet.getByRole("switch", {
		name: "Allow playful messages",
	});
	const initiallyEnabled = await preference.isChecked();

	if (initiallyEnabled) {
		await preference.click();
		await sheet.getByRole("button", { name: "Save playful messages" }).click();
		await expect(page).toHaveURL(/\/profile$/);
		await expect(
			page.getByRole("button", { name: /Playful messages/ }),
		).toContainText("Off");
		await page.getByRole("button", { name: /Playful messages/ }).click();
		sheet = page.getByRole("dialog", { name: "Playful messages" });
		preference = sheet.getByRole("switch", { name: "Allow playful messages" });
	}

	await expect(preference).not.toBeChecked();
	await preference.click();
	await sheet.getByRole("button", { name: "Save playful messages" }).click();
	await expect(page).toHaveURL(/\/profile$/);
	await expect(page.getByRole("button", { name: /Playful messages/ })).toContainText(
		"On",
	);

	await page.reload();
	await waitForAppReady(page);
	await expect(page.getByRole("button", { name: /Playful messages/ })).toContainText(
		"On",
	);
	await page.getByRole("button", { name: /Playful messages/ }).click();
	sheet = page.getByRole("dialog", { name: "Playful messages" });
	preference = sheet.getByRole("switch", { name: "Allow playful messages" });
	await expect(preference).toBeChecked();

	if (initiallyEnabled) {
		await page.keyboard.press("Escape");
		await expect(page).toHaveURL(/\/profile$/);
	} else {
		await preference.click();
		await sheet.getByRole("button", { name: "Save playful messages" }).click();
		await expect(page).toHaveURL(/\/profile$/);
		await expect(
			page.getByRole("button", { name: /Playful messages/ }),
		).toContainText("Off");
	}
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
	await openFoodPreferenceDisclosure(
		foodPreferencesView,
		"Package-label region",
	);
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

test("food preference details explain policy, exact measurements, and ordered priorities", async ({
	page,
}) => {
	await page.goto("/profile/food-preferences");
	await waitForAppReady(page);
	const foodPreferencesView = page.getByRole("dialog", {
		name: "Food preferences",
	});

	const regionSection = await openFoodPreferenceDisclosure(
		foodPreferencesView,
		"Package-label region",
	);
	await expect(regionSection.getByText("U.S. Food and Drug Administration"))
		.toBeVisible();
	await expect(regionSection.getByText(/Food-safety policy version \d+/))
		.toBeVisible();

	const measurementSection = await openFoodPreferenceDisclosure(
		foodPreferencesView,
		"Measurements",
	);
	const servingUnit = measurementSection.getByRole("combobox", {
		name: "Default serving unit",
	});
	await servingUnit.click();
	await measurementSection.getByRole("option", { name: "g", exact: true }).click();
	await measurementSection.getByRole("spinbutton", {
		name: "Default Mix starting amount",
	}).fill("28.349523125");
	await expect(
		measurementSection.getByText("28.3495 g = 1 oz · Exact unit conversion"),
	).toBeVisible();

	const nutrientSection = await openFoodPreferenceDisclosure(
		foodPreferencesView,
		"Nutrient priorities",
	);
	if (await nutrientSection.getByRole("button", { name: "Remove Protein" }).count() === 0) {
		const nutrientSelect = nutrientSection.getByRole("combobox", {
			name: "Add a nutrient priority",
		});
		await nutrientSelect.click();
		await nutrientSection.getByRole("option", { name: "Protein (g)" }).click();
		await nutrientSection.getByRole("button", { name: "Add priority" }).click();
	}
	await expect(nutrientSection.getByText("Default Mix target: 25 g"))
		.toBeVisible();
	await expect(
		nutrientSection.getByRole("button", { name: "Move Protein down" }),
	).toBeVisible();
});

test("food preferences use database choices and preserve exact custom wording", async ({
	page,
}) => {
	const customAllergen = "Molluscs, shellfish sensitivity";
	await page.goto("/profile/food-preferences");
	await waitForAppReady(page);

	let foodPreferencesView = page.getByRole("dialog", {
		name: "Food preferences",
	});
	for (const sectionTitle of [
		"Package-label region",
		"Measurements",
		"Allergens",
		"Dietary restrictions",
		"Nutrient priorities",
	]) {
		await expect(
			foodPreferencesView.locator("summary").filter({ hasText: sectionTitle }),
		).toHaveCount(1);
	}
	await expect(
		foodPreferencesView.locator("summary").filter({ hasText: "Saved preferences" }),
	).toHaveCount(0);
	await expect(
		foodPreferencesView.locator("summary").filter({ hasText: "Privacy" }),
	).toHaveCount(0);
	await expect(
		foodPreferencesView.getByRole("heading", { name: "Private account settings" }),
	).toBeVisible();
	const allergenSection = await openFoodPreferenceDisclosure(
		foodPreferencesView,
		"Allergens",
	);
	const dietarySection = await openFoodPreferenceDisclosure(
		foodPreferencesView,
		"Dietary restrictions",
	);

	const reviewedAllergenSearch = allergenSection.getByLabel(
		"Find reviewed allergens",
	);
	await reviewedAllergenSearch.fill("sesame");
	await expect(
		allergenSection.getByRole("button", { name: /Sesame/ }),
	).toBeVisible();
	await expect(
		allergenSection.getByRole("button", { name: /Peanut/ }),
	).toHaveCount(0);
	await reviewedAllergenSearch.fill("peanut");
	await allergenSection.getByRole("button", { name: /Peanut/ }).click();
	await allergenSection.getByLabel("Add a specific allergen").fill(customAllergen);
	await allergenSection.getByRole("button", { name: "Add", exact: true }).click();
	await dietarySection.getByLabel("Find reviewed dietary restrictions").fill("vegan");
	await dietarySection.getByRole("button", { name: /Vegan/ }).click();
	await expect(allergenSection.locator("summary")).toContainText(
		"1 active · 1 pending",
	);
	await allergenSection.locator("summary").click();
	await expect(
		allergenSection.getByRole("button", { name: "Remove Peanut" }),
	).not.toBeVisible();
	await allergenSection.locator("summary").click();
	await expect(
		allergenSection.getByRole("button", { name: "Remove Peanut" }),
	).toBeVisible();
	await expect(allergenSection.getByText(customAllergen, { exact: true }))
		.toBeVisible();
	await expect(allergenSection.getByText("Waiting for review")).toBeVisible();
	await foodPreferencesView
		.getByRole("checkbox", { name: /I understand and want to save/ })
		.check();
	const preferenceViewWidth = await foodPreferencesView.evaluate((element) => ({
		clientWidth: element.clientWidth,
		scrollWidth: element.scrollWidth,
	}));
	expect(preferenceViewWidth.scrollWidth).toBeLessThanOrEqual(
		preferenceViewWidth.clientWidth + 1,
	);
	await foodPreferencesView
		.getByRole("button", { name: "Save food preferences" })
		.click();
	await expect(page).toHaveURL(/\/profile$/);
	await expect(page.getByRole("button", { name: /Food preferences/ }))
		.toContainText("2 active · 1 pending");

	await page.getByRole("button", { name: /Food preferences/ }).click();
	await expect(page).toHaveURL(/\/profile\/food-preferences$/);
	foodPreferencesView = page.getByRole("dialog", { name: "Food preferences" });
	await openFoodPreferenceDisclosure(foodPreferencesView, "Allergens");
	await openFoodPreferenceDisclosure(foodPreferencesView, "Dietary restrictions");
	await expect(foodPreferencesView.getByText(customAllergen, { exact: true }))
		.toBeVisible();
	await expect(
		foodPreferencesView.getByRole("button", { name: "Remove Peanut" }),
	).toBeVisible();
	await expect(
		foodPreferencesView.getByRole("button", { name: "Remove Vegan" }),
	).toBeVisible();

	await foodPreferencesView.getByRole("button", { name: "Clear allergens" }).click();
	await expect(
		foodPreferencesView.getByRole("button", { name: `Remove ${customAllergen}` }),
	).toHaveCount(0);
	await foodPreferencesView.getByRole("button", { name: "Remove Vegan" }).click();
	await foodPreferencesView
		.getByRole("button", { name: "Save food preferences" })
		.click();
	await expect(page).toHaveURL(/\/profile$/);
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
	for (const sectionTitle of ["Allergens", "Dietary restrictions", "Nutrient priorities"]) {
		await openFoodPreferenceDisclosure(foodPreferencesBody, sectionTitle);
	}
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

test("logout ends the session without deleting durable account data", async ({
	page,
}, testInfo) => {
	const qaAccount = getLocalQaAccountForWorker(testInfo.parallelIndex);
	const isolatedSessionResponse = await page.request.post(
		"/auth?/emailSignIn",
		{
			headers: {
				origin:
					process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5174",
			},
			form: {
				email: qaAccount.email,
				next: "/profile",
				password: qaAccount.password,
			},
		},
	);
	expect(
		isolatedSessionResponse.ok(),
		"The logout test could not create an isolated browser session.",
	).toBe(true);
	await page.goto("/profile");
	await waitForAppReady(page);

	const profileDisplayName = (
		await page.locator(".profile-identity-summary__copy strong").innerText()
	).trim();
	const foodPreferenceSummary = (
		await page
			.getByRole("button", { name: /Food preferences/ })
			.locator(".profile-settings-sheet-launcher__copy span")
			.innerText()
	).trim();

	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	const fridgeTabText = (
		await page.getByRole("tab", { name: /Fridge/ }).innerText()
	).trim();
	const shoppingListTabText = (
		await page.getByRole("tab", { name: /Shopping List/ }).innerText()
	).trim();

	await page.goto("/profile");
	await waitForAppReady(page);
	const accountSessionSection = page
		.locator(".profile-settings-section")
		.filter({ has: page.getByRole("heading", { name: "Account session" }) });
	const logoutButton = accountSessionSection.getByRole("button", {
		name: "Log out",
		exact: true,
	});
	const logoutForm = accountSessionSection.locator("form");

	await expect(logoutButton).toHaveCount(1);
	await expect(logoutButton).toHaveAttribute("data-variant", "neutral");
	await expectFocusOutlineInsideBoundary(logoutButton, accountSessionSection);
	const logoutButtonBounds = await logoutButton.boundingBox();
	expect(logoutButtonBounds).not.toBeNull();
	expect(logoutButtonBounds!.width).toBeGreaterThanOrEqual(44);
	expect(logoutButtonBounds!.height).toBeGreaterThanOrEqual(44);

	await logoutForm.evaluate((form) => {
		form.addEventListener("submit", (event) => event.preventDefault(), {
			once: true,
		});
	});
	if (testInfo.project.name.startsWith("mobile-")) {
		await logoutButton.tap();
	} else {
		await logoutButton.press("Enter");
	}
	await expect(logoutForm).toHaveAttribute("aria-busy", "true");
	await expect(logoutButton).toHaveAttribute("aria-busy", "true");
	await expect(logoutButton).toBeDisabled();
	await expect(logoutButton.locator(".loading-spinner")).toBeVisible();

	await page.reload();
	await waitForAppReady(page);
	const logoutPostRequest = page.waitForRequest((request) => {
		return (
			request.method() === "POST" &&
			new URL(request.url()).pathname === "/auth/logout"
		);
	});
	const logoutAfterReload = page
		.locator(".profile-settings-section")
		.filter({ has: page.getByRole("heading", { name: "Account session" }) })
		.getByRole("button", { name: "Log out", exact: true });
	if (testInfo.project.name.startsWith("mobile-")) {
		await logoutAfterReload.tap();
	} else {
		await logoutAfterReload.click();
	}
	await logoutPostRequest;
	await expect(page).toHaveURL(/\/$/);
	await waitForAppReady(page);

	const protectedProfileResponse = await page.request.get("/profile", {
		maxRedirects: 0,
	});
	expect(protectedProfileResponse.status()).toBe(303);
	const protectedProfileLocation = protectedProfileResponse.headers().location;
	if (!protectedProfileLocation) {
		throw new Error("The protected Profile route did not return a redirect location.");
	}
	const protectedProfileRedirect = new URL(
		protectedProfileLocation,
		page.url(),
	);
	expect(`${protectedProfileRedirect.pathname}${protectedProfileRedirect.search}`).toBe(
		"/?next=%2Fprofile",
	);
	await page.goto("/auth?next=/profile");
	await page.getByLabel("Email").fill(qaAccount.email);
	await page.getByLabel("Password", { exact: true }).fill(qaAccount.password);
	await page.getByRole("button", { name: "Sign in", exact: true }).click();
	await expect(page).toHaveURL(/\/profile$/);
	await waitForAppReady(page);

	await expect(
		page.locator(".profile-identity-summary__copy strong"),
	).toHaveText(profileDisplayName);
	await expect(
		page
			.getByRole("button", { name: /Food preferences/ })
			.locator(".profile-settings-sheet-launcher__copy span"),
	).toHaveText(foodPreferenceSummary);

	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	await expect(page.getByRole("tab", { name: /Fridge/ })).toHaveText(
		fridgeTabText,
	);
	await expect(page.getByRole("tab", { name: /Shopping List/ })).toHaveText(
		shoppingListTabText,
	);
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
	await expect(
		moderatorActionsSheet.getByRole("heading", { name: "Moderator actions" }),
	).toHaveCount(1);
	await expect(
		moderatorActionsSheet.locator(
			".bottom-sheet__title-accessory .privileged-action-badge",
		),
	).toHaveCount(1);
	for (const actionName of [
		"Product submissions",
		"Food warning reports",
		"Profile images",
		"Account access",
		"Catalog data health",
	]) {
		await expect(
			moderatorActionsSheet.getByRole("button", { name: new RegExp(actionName) }),
		).toBeEnabled();
	}
	await expect(
		moderatorActionsSheet.getByText(
			"Verify with your authenticator when you open a protected tool. Review counts stay private until then.",
		),
	).toBeVisible();
	await expect(
		moderatorActionsSheet.getByText(
			"Verify your identity to check this queue",
		),
	).toHaveCount(3);

	await moderatorActionsSheet
		.getByRole("button", { name: /Product submissions/ })
		.click();
	await expect(page).toHaveURL(
		/\/auth\/mfa\/enroll\?next=%2Fprofile%2Fmoderator-actions%2Fproduct-submissions$/,
	);
	await expect(
		page.getByRole("heading", { name: "Set up your authenticator." }),
	).toBeVisible();
});
