import {
	expect,
	expectCompactHeaderHidesAndRevealsWithScroll,
	expectFocusOutlineInsideBoundary,
	signInLocalQaAccount,
	test,
	waitForAppReady,
} from "./support/browserTest";
import { execFile } from "node:child_process";
import type { Locator } from "@playwright/test";
import {
	getAuthenticatedBrowserStatePath,
	getLocalQaAccountForWorker,
} from "./support/localQaAccounts";
import {
	cleanupLocalQaCatalogDiagnosticReview,
	seedLocalQaCatalogDiagnosticReview,
	createLocalQaPendingNutrientMapping,
	deleteLocalQaAuthenticatorFactorsForEmail,
	deleteLocalQaPendingNutrientMapping,
	recheckLocalQaDeterministicNutrientMapping,
	resetLocalQaDatasetImportEvidence,
} from "./support/localQaDatabase";
import { finishLocalQaAuthenticatorEnrollment } from "./support/localQaAuthenticator";

const tinyPng = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
	"base64",
);

const moderatorEmail = "qa-moderator@blendcalc.local";

const runImageModerationFixture = async (command: "seed" | "cleanup") =>
	new Promise<void>((resolve, reject) => {
		execFile(
			process.execPath,
			[
				"scripts/qa/catalog/seed_image_moderation_submission.mjs",
				command,
				moderatorEmail,
				"addition",
			],
			{
				cwd: process.cwd(),
				env: {
					...process.env,
					BLENDCALC_DATABASE_ENVIRONMENT: "test",
				},
				maxBuffer: 256 * 1024,
			},
			(error, stdout, stderr) => {
				if (error) {
					reject(
						new Error(
							`Could not ${command} the image-moderation fixture: ${stderr || stdout || error.message}`,
						),
					);
					return;
				}
				resolve();
			},
		);
	});

const setRangeValue = async (slider: Locator, value: number) => {
	await slider.evaluate((element, nextValue) => {
		const input = element as HTMLInputElement;
		input.value = String(nextValue);
		input.dispatchEvent(new Event("input", { bubbles: true }));
		input.dispatchEvent(new Event("change", { bubbles: true }));
	}, value);
};

const openFoodPreferenceDisclosure = async (
	foodPreferencesView: Locator,
	title: string,
) => {
	const summary = foodPreferencesView
		.locator("summary")
		.filter({ hasText: title });
	const disclosure = summary.locator("xpath=..");
	if (
		!(await disclosure.evaluate(
			(element) => (element as HTMLDetailsElement).open,
		))
	) {
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
	const themeGroup = appearanceSheet.getByRole("group", {
		name: "Color theme",
	});
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
	await expect(
		page.getByRole("button", { name: /Playful messages/ }),
	).toContainText("On");

	await page.reload();
	await waitForAppReady(page);
	await expect(
		page.getByRole("button", { name: /Playful messages/ }),
	).toContainText("On");
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

test("optional email categories persist independently and can all be turned off", async ({
	page,
}) => {
	await page.goto("/profile/email-preferences");
	await waitForAppReady(page);
	await expect(page).toHaveTitle("Email Preferences · blendCalc");

	let sheet = page.getByRole("dialog", { name: "Email preferences" });
	const productUpdates = sheet.getByRole("switch", {
		name: "Product and launch updates",
	});
	const testingInvitations = sheet.getByRole("switch", {
		name: "MVP testing invitations",
	});
	const tips = sheet.getByRole("switch", {
		name: "Tips, recipes, and education",
	});

	await productUpdates.click();
	await testingInvitations.click();
	await expect(productUpdates).toBeChecked();
	await expect(testingInvitations).toBeChecked();
	await expect(tips).not.toBeChecked();
	await sheet.getByRole("button", { name: "Save email preferences" }).click();
	await expect(page).toHaveURL(/\/profile$/);
	await expect(
		page.getByRole("button", { name: /Email preferences/ }),
	).toContainText("2 optional categories on");

	await page.reload();
	await waitForAppReady(page);
	await page.getByRole("button", { name: /Email preferences/ }).click();
	sheet = page.getByRole("dialog", { name: "Email preferences" });
	await expect(
		sheet.getByRole("switch", { name: "Product and launch updates" }),
	).toBeChecked();
	await expect(
		sheet.getByRole("switch", { name: "MVP testing invitations" }),
	).toBeChecked();

	await sheet
		.getByRole("button", { name: "Turn off all promotional email" })
		.click();
	await sheet.getByRole("button", { name: "Save email preferences" }).click();
	await expect(page).toHaveURL(/\/profile$/);
	await expect(
		page.getByRole("button", { name: /Email preferences/ }),
	).toContainText("All promotional email is off");
});

test(
	"profile image upload, description, preview, and removal persist",
	{ tag: "@mobile" },
	async ({ page }, testInfo) => {
		const initialDescription = `Playwright ${testInfo.project.name} profile`;
		const updatedDescription = `${initialDescription} updated`;

		await page.goto("/profile/image");
		await waitForAppReady(page);
		let profileImageSheet = page.getByRole("dialog", {
			name: "Profile image",
		});

		if (
			(await profileImageSheet
				.getByRole("button", { name: "Remove image" })
				.count()) > 0
		) {
			await profileImageSheet
				.getByRole("button", { name: "Remove image" })
				.click();
			await expect(
				profileImageSheet.getByText(
					"Select remove again to permanently remove this profile image.",
				),
			).toBeVisible();
			await profileImageSheet
				.getByRole("button", { name: "Confirm removal" })
				.click();
			await expect(page).toHaveURL(/\/profile$/);
			await page.goto("/profile/image");
			await waitForAppReady(page);
			profileImageSheet = page.getByRole("dialog", {
				name: "Profile image",
			});
		}

		const input = profileImageSheet.locator(
			'input[type="file"][name="avatar"]',
		);
		await input.setInputFiles({
			name: "playwright-profile.png",
			mimeType: "image/png",
			buffer: tinyPng,
		});
		await expect(page.getByText("playwright-profile.png")).toBeVisible();
		await expect(
			profileImageSheet.getByRole("button", {
				name: "Clear profile photo selection",
			}),
		).toBeVisible();
		await profileImageSheet
			.getByRole("textbox", { name: "Image description" })
			.fill(initialDescription);
		await profileImageSheet
			.getByRole("checkbox", {
				name: /I confirm this image follows the profile image rules/,
			})
			.check();
		await profileImageSheet
			.getByRole("button", { name: "Upload image" })
			.click();
		await expect(page).toHaveURL(/\/profile$/);

		await page.getByRole("button", { name: /Profile image/ }).click();
		await expect(page).toHaveURL(/\/profile\/image$/);
		profileImageSheet = page.getByRole("dialog", { name: "Profile image" });
		await expect(
			profileImageSheet.getByRole("img", { name: initialDescription }),
		).toBeVisible();
		await expect(profileImageSheet.getByText("Ready to use")).toBeVisible();
		const savedDescription = profileImageSheet.getByRole("textbox", {
			name: "Image description",
		});
		await expect(savedDescription).toHaveValue(initialDescription);
		await savedDescription.fill(updatedDescription);
		await profileImageSheet
			.getByRole("button", { name: "Save description" })
			.click();
		await expect(page).toHaveURL(/\/profile$/);

		await page.getByRole("button", { name: /Profile image/ }).click();
		profileImageSheet = page.getByRole("dialog", { name: "Profile image" });
		await expect(
			profileImageSheet.getByRole("img", { name: updatedDescription }),
		).toBeVisible();
		await profileImageSheet
			.getByRole("button", { name: "Remove image" })
			.click();
		await expect(page).toHaveURL(/\/profile\/image$/);
		await expect(
			profileImageSheet.getByRole("button", { name: "Confirm removal" }),
		).toBeVisible();
		await profileImageSheet
			.getByRole("button", { name: "Confirm removal" })
			.click();
		await expect(page).toHaveURL(/\/profile$/);

		await page.getByRole("button", { name: /Profile image/ }).click();
		profileImageSheet = page.getByRole("dialog", { name: "Profile image" });
		await expect(profileImageSheet.getByText("Current image")).toHaveCount(0);
		await expect(
			profileImageSheet.getByRole("button", { name: "Upload image" }),
		).toBeVisible();
	},
);

test("profile selects support keyboard dismissal without changing the value", async ({
	page,
}) => {
	await page.goto("/profile");
	await waitForAppReady(page);
	await page.getByRole("button", { name: /Food preferences/ }).click();
	await expect(page).toHaveURL(/\/profile\/food-preferences$/);

	const foodPreferencesView = page.getByRole("dialog", {
		name: "Food preferences",
	});
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
	await expect(
		regionSection.getByText("U.S. Food and Drug Administration"),
	).toBeVisible();
	await expect(
		regionSection.getByText(/Food-safety policy version \d+/),
	).toBeVisible();

	const measurementSection = await openFoodPreferenceDisclosure(
		foodPreferencesView,
		"Measurements",
	);
	const servingUnit = measurementSection.getByRole("combobox", {
		name: "Default serving unit",
	});
	await servingUnit.click();
	await measurementSection
		.getByRole("option", { name: "g", exact: true })
		.click();
	await measurementSection
		.getByRole("spinbutton", {
			name: "Default Mix starting amount",
		})
		.fill("28.349523125");
	await expect(
		measurementSection.getByText("28.3495 g = 1 oz · Exact unit conversion"),
	).toBeVisible();

	const nutrientSection = await openFoodPreferenceDisclosure(
		foodPreferencesView,
		"Nutrient priorities",
	);
	if (
		(await nutrientSection
			.getByRole("button", { name: "Remove Protein" })
			.count()) === 0
	) {
		const nutrientSelect = nutrientSection.getByRole("combobox", {
			name: "Add a nutrient priority",
		});
		await nutrientSelect.click();
		await nutrientSection.getByRole("option", { name: "Protein (g)" }).click();
		await nutrientSection.getByRole("button", { name: "Add priority" }).click();
	}
	await expect(
		nutrientSection.getByText("Default Mix target: 25 g"),
	).toBeVisible();
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
		foodPreferencesView
			.locator("summary")
			.filter({ hasText: "Saved preferences" }),
	).toHaveCount(0);
	await expect(
		foodPreferencesView.locator("summary").filter({ hasText: "Privacy" }),
	).toHaveCount(0);
	await expect(
		foodPreferencesView.getByRole("heading", {
			name: "Private account settings",
		}),
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
	await allergenSection
		.getByLabel("Add a specific allergen")
		.fill(customAllergen);
	await allergenSection
		.getByRole("button", { name: "Add", exact: true })
		.click();
	await dietarySection
		.getByLabel("Find reviewed dietary restrictions")
		.fill("vegan");
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
	await expect(
		allergenSection.getByText(customAllergen, { exact: true }),
	).toBeVisible();
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
	await expect(
		page.getByRole("button", { name: /Food preferences/ }),
	).toContainText("2 active · 1 pending");

	await page.getByRole("button", { name: /Food preferences/ }).click();
	await expect(page).toHaveURL(/\/profile\/food-preferences$/);
	foodPreferencesView = page.getByRole("dialog", { name: "Food preferences" });
	await openFoodPreferenceDisclosure(foodPreferencesView, "Allergens");
	await openFoodPreferenceDisclosure(
		foodPreferencesView,
		"Dietary restrictions",
	);
	await expect(
		foodPreferencesView.getByText(customAllergen, { exact: true }),
	).toBeVisible();
	await expect(
		foodPreferencesView.getByRole("button", { name: "Remove Peanut" }),
	).toBeVisible();
	await expect(
		foodPreferencesView.getByRole("button", { name: "Remove Vegan" }),
	).toBeVisible();

	await foodPreferencesView
		.getByRole("button", { name: "Clear allergens" })
		.click();
	await expect(
		foodPreferencesView.getByRole("button", {
			name: `Remove ${customAllergen}`,
		}),
	).toHaveCount(0);
	await foodPreferencesView
		.getByRole("button", { name: "Remove Vegan" })
		.click();
	await foodPreferencesView
		.getByRole("button", { name: "Save food preferences" })
		.click();
	await expect(page).toHaveURL(/\/profile$/);
});

test(
	"compact Profile header leaves and returns with main-page scroll direction",
	{ tag: "@mobile" },
	async ({ page }, testInfo) => {
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
		for (const sectionTitle of [
			"Allergens",
			"Dietary restrictions",
			"Nutrient priorities",
		]) {
			await openFoodPreferenceDisclosure(foodPreferencesBody, sectionTitle);
		}
		const sheetMaximumScrollTop = await foodPreferencesBody.evaluate(
			(element) => {
				const nextScrollTop = element.scrollHeight - element.clientHeight;
				element.scrollTo({ top: nextScrollTop });
				return nextScrollTop;
			},
		);
		expect(sheetMaximumScrollTop).toBeGreaterThan(0);
		await expect
			.poll(() =>
				viewTop.evaluate((element) =>
					element.classList.contains("view-top--compact-hidden"),
				),
			)
			.toBe(headerWasHiddenBeforeSheetScroll);
	},
);

test("Profile settings use routed sheets and restore launcher focus", async ({
	page,
}) => {
	await page.goto("/profile");
	await waitForAppReady(page);

	const detailsLauncher = page.getByRole("button", { name: /Profile details/ });
	await detailsLauncher.click();
	await expect(page).toHaveURL(/\/profile\/details$/);
	const profileDetailsSheet = page.getByRole("dialog", {
		name: "Profile details",
	});
	await expect(profileDetailsSheet).toBeVisible();
	const bioField = profileDetailsSheet.getByRole("textbox", { name: "Bio" });
	await expect(bioField).toHaveAttribute("maxlength", "150");
	const initialBioLength = (await bioField.inputValue()).length;
	await expect(
		profileDetailsSheet.getByText(`${initialBioLength} / 150`),
	).toBeVisible();
	await bioField.fill("Profile bio");
	await expect(profileDetailsSheet.getByText("11 / 150")).toBeVisible();
	await expect(bioField).toHaveAccessibleDescription(
		"139 characters remaining",
	);
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
				origin: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5174",
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
		throw new Error(
			"The protected Profile route did not return a redirect location.",
		);
	}
	const protectedProfileRedirect = new URL(
		protectedProfileLocation,
		page.url(),
	);
	expect(
		`${protectedProfileRedirect.pathname}${protectedProfileRedirect.search}`,
	).toBe("/?next=%2Fprofile");
	const restoredSessionResponse = await page.request.post(
		"/auth?/emailSignIn",
		{
			headers: {
				origin: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5174",
			},
			form: {
				email: qaAccount.email,
				next: "/profile",
				password: qaAccount.password,
			},
		},
	);
	expect(
		restoredSessionResponse.ok(),
		"The logout test could not restore its isolated browser session.",
	).toBe(true);
	await page.goto("/profile");
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
	await page.context().storageState({
		path: getAuthenticatedBrowserStatePath(
			testInfo.project.name,
			testInfo.parallelIndex,
		),
	});
});

test("privileged tools stay hidden from regular accounts and use the shared sheet for elevated accounts", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One isolated Chromium project owns the shared moderator MFA persona.",
	);
	await deleteLocalQaAuthenticatorFactorsForEmail(moderatorEmail);
	await page.goto("/profile");
	await waitForAppReady(page);
	await expect(
		page.getByRole("button", { name: /Moderator tools/ }),
	).toHaveCount(0);

	await signInLocalQaAccount({
		page,
		email: moderatorEmail,
		nextPath: "/profile",
	});

	await page.getByRole("button", { name: /Moderator tools/ }).click();
	await expect(page).toHaveURL(/\/profile\/privileged-tools$/);
	const privilegedToolsSheet = page.getByRole("dialog", {
		name: "Moderator tools",
	});
	await expect(privilegedToolsSheet).toBeVisible();
	await expect(
		privilegedToolsSheet.getByRole("heading", { name: "Moderator tools" }),
	).toHaveCount(1);
	await expect(
		privilegedToolsSheet.locator(
			".bottom-sheet__title-accessory .privileged-action-badge",
		),
	).toHaveCount(1);
	for (const actionName of [
		"Product submissions",
		"Catalog review work",
		"Food warning reports",
		"Profile images",
		"Account access",
	]) {
		await expect(
			privilegedToolsSheet.getByRole("button", {
				name: new RegExp(actionName),
			}),
		).toBeEnabled();
	}
	await expect(
		privilegedToolsSheet.getByText("Verify once to see today's work"),
	).toBeVisible();
	await expect(
		privilegedToolsSheet.getByText(
			"Open any protected tool and complete authenticator verification. Counts will appear without exposing review work first.",
		),
	).toBeVisible();
	await expect(
		privilegedToolsSheet.getByText("Verify your identity to check this queue"),
	).toHaveCount(4);

	await privilegedToolsSheet
		.getByRole("button", { name: /Product submissions/ })
		.click();
	await expect(page).toHaveURL(
		/\/auth\/mfa\/enroll\?next=%2Fprofile%2Fprivileged-tools%2Fproduct-submissions$/,
	);
	await expect(
		page.getByRole("heading", { name: "Set up your authenticator." }),
	).toBeVisible();

	try {
		await finishLocalQaAuthenticatorEnrollment(page);
		await runImageModerationFixture("seed");
		await page.reload();
		await waitForAppReady(page);

		await expect(page).toHaveURL(
			/\/profile\/privileged-tools\/product-submissions$/,
		);
		const productSubmissionSheet = page.getByRole("dialog", {
			name: "Product submissions",
		});
		await expect(productSubmissionSheet).toBeVisible();
		await expect(
			productSubmissionSheet.getByText(/submission(?:s)? waiting for review/),
		).toBeVisible();
		await expect(
			productSubmissionSheet.getByRole("heading", {
				name: /Review \d+ submissions?/,
			}),
		).toBeVisible();
		await expect(productSubmissionSheet.getByText("Done when")).toBeVisible();

		const imageSubmission = productSubmissionSheet
			.locator("article.moderator-review-card")
			.filter({ hasText: "[QA Image] Image Addition Granola" })
			.first();
		await expect(imageSubmission).toBeVisible();

		await imageSubmission
			.locator("summary")
			.filter({ hasText: "Package evidence" })
			.click();
		const privateEvidence = imageSubmission.getByLabel(
			"Private product evidence",
		);
		await expect(privateEvidence.getByRole("img")).toHaveCount(3);
		const originalFrontImage = privateEvidence.getByRole("img", {
			name: "Front of package",
		});
		await expect(originalFrontImage).toBeVisible();

		await imageSubmission
			.locator("summary")
			.filter({ hasText: "Card image placement" })
			.click();
		const placementEditor = imageSubmission.getByRole("region", {
			name: "Card image preview",
		});
		const liveCardPreview = placementEditor.getByRole("group", {
			name: "Interactive card image preview",
		});
		await expect(liveCardPreview).toBeVisible();
		await expect(
			liveCardPreview.locator(".ingredient-card-media-lane"),
		).toHaveCount(1);
		await expect(imageSubmission.locator(".product-image-frame")).toHaveCount(
			0,
		);
		const originalFrontImageUrl = await originalFrontImage.getAttribute("src");
		expect(originalFrontImageUrl).toBeTruthy();
		await expect(
			liveCardPreview.getByRole("img", { name: "Product image preview" }),
		).toHaveAttribute("src", originalFrontImageUrl!);

		const sharedGeometry = await liveCardPreview.evaluate((element) => {
			const styles = getComputedStyle(element);
			return {
				contentInset: styles
					.getPropertyValue("--ingredient-card-content-inset")
					.trim(),
				mediaLaneWidth: styles
					.getPropertyValue("--ingredient-card-media-lane-width")
					.trim(),
				mediaMask: getComputedStyle(
					element.querySelector(".ingredient-card-media-lane")!,
				).maskImage,
			};
		});
		expect(sharedGeometry.mediaLaneWidth).toBe("28cqw");
		expect(sharedGeometry.contentInset).toContain("18cqw");
		expect(sharedGeometry.mediaMask).toContain("radial-gradient");

		await setRangeValue(
			placementEditor.getByRole("slider", { name: "Image zoom" }),
			1.65,
		);
		await setRangeValue(
			placementEditor.getByRole("slider", { name: "Shift image left" }),
			60,
		);
		const verticalPosition = placementEditor.getByRole("slider", {
			name: "Vertical image position",
		});
		await expect(verticalPosition).toBeEnabled();
		await setRangeValue(verticalPosition, 35);

		const productDecision = imageSubmission.getByRole("combobox", {
			name: "1. What does the package evidence support?",
		});
		await expect(productDecision).toContainText("Choose a decision");
		await expect(
			imageSubmission.getByRole("button", {
				name: "Approve and publish submission",
			}),
		).toHaveCount(0);
		await expect(
			imageSubmission.getByRole("button", { name: "Reject submission" }),
		).toHaveCount(0);
		await productDecision.click();
		await imageSubmission
			.getByRole("option", {
				name: "Reject — the submission needs a correction",
			})
			.click();
		const rejectSubmission = imageSubmission.getByRole("button", {
			name: "Reject submission",
		});
		await expect(rejectSubmission).toBeDisabled();
		await imageSubmission
			.getByRole("textbox", {
				name: "2. What must the submitter correct?",
			})
			.fill("QA review note confirms the deliberate decision gate.");
		await expect(rejectSubmission).toBeEnabled();

		await page.goto("/profile");
		await waitForAppReady(page);
		const verifiedLauncher = page.getByRole("button", {
			name: /Moderator tools/,
		});
		const aggregateBadge = verifiedLauncher.locator(
			".action-required-count-badge",
		);
		await expect(aggregateBadge).toBeVisible();
		const aggregateCount = Number(await aggregateBadge.textContent());
		expect(aggregateCount).toBeGreaterThan(0);

		await verifiedLauncher.click();
		const verifiedToolsSheet = page.getByRole("dialog", {
			name: "Moderator tools",
		});
		const actionCounts = await verifiedToolsSheet
			.locator(".bottom-sheet-action .action-required-count-badge")
			.evaluateAll((badges) =>
				badges.map((badge) => Number(badge.textContent ?? "0")),
			);
		expect(actionCounts.reduce((sum, count) => sum + count, 0)).toBe(
			aggregateCount,
		);
		const emptyCatalogReviewAction = verifiedToolsSheet.getByRole("button", {
			name: /Catalog review work/,
		});
		await expect(emptyCatalogReviewAction).toBeEnabled();
		await expect(emptyCatalogReviewAction).toContainText(
			"Nothing is waiting for review",
		);
		await expect(
			emptyCatalogReviewAction.locator(".action-required-count-badge"),
		).toHaveCount(0);
		await expect(
			verifiedToolsSheet
				.getByRole("button", { name: /Account access/ })
				.locator(".action-required-count-badge"),
		).toHaveCount(0);

		for (const protectedTool of [
			{
				path: "/profile/privileged-tools/catalog-review-work",
				title: "Catalog review work",
				content: /catalog decisions? need review/,
			},
			{
				path: "/profile/privileged-tools/food-warning-reports",
				title: "Food warning reports",
				content: "No food warning reports need review",
			},
			{
				path: "/profile/privileged-tools/profile-images",
				title: "Profile images",
				content: "No reported profile images need review",
			},
			{
				path: "/profile/privileged-tools/account-access",
				title: "Account access",
				content: /accounts$/,
			},
		] as const) {
			await page.goto(protectedTool.path);
			await waitForAppReady(page);
			const protectedToolSheet = page.getByRole("dialog", {
				name: protectedTool.title,
			});
			await expect(protectedToolSheet).toBeVisible();
			await expect(
				protectedToolSheet.getByText(protectedTool.content).first(),
			).toBeVisible();
		}

		await page.goto("/moderation");
		await expect(page).toHaveURL(
			(url) => url.pathname === "/profile/privileged-tools",
		);
	} finally {
		try {
			await runImageModerationFixture("cleanup");
		} finally {
			await deleteLocalQaAuthenticatorFactorsForEmail(moderatorEmail);
		}
	}
});

test("administrators can open data operations after direct AAL2 verification", async ({
	page,
}, testInfo) => {
	test.setTimeout(90_000);
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One isolated Chromium project owns the shared administrator MFA persona.",
	);
	const adminEmail = "qa-admin@blendcalc.local";
	const dataOperationsPath = "/profile/privileged-tools/data-operations";
	await deleteLocalQaAuthenticatorFactorsForEmail(adminEmail);
	const diagnosticFixture = await seedLocalQaCatalogDiagnosticReview();
	const pendingMappingId = await createLocalQaPendingNutrientMapping();
	const resolvedMappingId = await recheckLocalQaDeterministicNutrientMapping();
	await resetLocalQaDatasetImportEvidence("cnf-2026");

	try {
		await signInLocalQaAccount({
			page,
			email: adminEmail,
			nextPath: "/profile",
		});
		await page.goto(dataOperationsPath);
		await expect(page).toHaveURL(
			/\/auth\/mfa\/enroll\?next=%2Fprofile%2Fprivileged-tools%2Fdata-operations$/,
		);
		await finishLocalQaAuthenticatorEnrollment(page);

		await expect(page).toHaveURL((url) => url.pathname === dataOperationsPath);
		const dataOperationsSheet = page.getByRole("dialog", {
			name: "Data operations",
		});
		await expect(dataOperationsSheet).toBeVisible();
		await expect(
			dataOperationsSheet.getByRole("region", { name: "Catalog coverage" }),
		).toBeVisible();
		await expect(
			dataOperationsSheet.getByRole("region", { name: "Required work" }),
		).toBeVisible();
		const requiredWork = dataOperationsSheet.getByRole("region", {
			name: "Required work",
		});
		await expect(
			requiredWork.getByText("Canadian Nutrient File 2026"),
		).toBeVisible();
		await expect(
			requiredWork.getByText("UK Composition of Foods Integrated Dataset 2021"),
		).toBeVisible();
		await expect(
			requiredWork.getByText("Other tracked operational issues"),
		).toHaveCount(0);
		await expect(
			requiredWork.getByText("Cannot finish this in the app yet"),
		).toHaveCount(0);
		await expect(
			requiredWork.getByText(
				"Nothing changes until that workflow records reviewed evidence.",
			),
		).toHaveCount(0);

		const cnfDatasetCard = requiredWork
			.locator("article")
			.filter({ hasText: "Canadian Nutrient File 2026" });
		await expect(
			cnfDatasetCard.getByRole("link", { name: "Record dataset evidence" }),
		).toBeVisible();
		await page.setViewportSize({ width: 390, height: 844 });
		await cnfDatasetCard
			.getByRole("link", { name: "Record dataset evidence" })
			.click();
		const datasetEvidenceSheet = page.getByRole("dialog", {
			name: "Record dataset evidence",
		});
		await expect(datasetEvidenceSheet).toBeVisible();
		const datasetEvidenceBox = await datasetEvidenceSheet.boundingBox();
		expect(datasetEvidenceBox?.x ?? -1).toBeGreaterThanOrEqual(0);
		expect(
			(datasetEvidenceBox?.x ?? 0) + (datasetEvidenceBox?.width ?? 0),
		).toBeLessThanOrEqual(390);
		await datasetEvidenceSheet
			.getByLabel("2. When did the import finish? (UTC)")
			.fill("2026-09-10T21:30");
		await datasetEvidenceSheet
			.getByLabel("3. What is the source file SHA-256?")
			.fill("a".repeat(64));
		await datasetEvidenceSheet
			.getByRole("button", { name: "Preview evidence" })
			.click();
		await expect(
			datasetEvidenceSheet.getByText("This will complete the dataset evidence"),
		).toBeVisible();
		const applyDatasetEvidence = datasetEvidenceSheet.getByRole("button", {
			name: "Apply evidence and finish",
		});
		await expect(applyDatasetEvidence).toBeDisabled();
		await datasetEvidenceSheet
			.getByLabel("Why is this evidence trustworthy?")
			.fill("Verified against the retained browser QA import record.");
		await applyDatasetEvidence.scrollIntoViewIfNeeded();
		await expect(applyDatasetEvidence).toBeInViewport();
		await applyDatasetEvidence.click();
		await expect(page).toHaveURL(
			(url) =>
				url.pathname === dataOperationsPath &&
				url.searchParams.get("datasetEvidence") === "recorded",
		);
		await expect(
			dataOperationsSheet.getByText("Dataset evidence recorded"),
		).toBeVisible();
		await expect(
			dataOperationsSheet
				.getByRole("region", { name: "Required work" })
				.getByText("Canadian Nutrient File 2026"),
		).toHaveCount(0);
		await page.setViewportSize({ width: 1280, height: 800 });
		await expect(
			dataOperationsSheet.getByRole("region", { name: "Diagnostic checks" }),
		).toBeVisible();
		await expect(
			dataOperationsSheet.getByText(
				"These broader checks can overlap. Use them to investigate the required work above; they do not add to the red action total.",
			),
		).toBeVisible();
		await expect(
			dataOperationsSheet.getByText("Automated catalog monitoring"),
		).toBeVisible();
		const nutrientMappingGaps = dataOperationsSheet
			.locator("details")
			.filter({ hasText: "Nutrient mapping gaps" });
		await nutrientMappingGaps.locator("summary").click();
		await expect(
			nutrientMappingGaps.locator(
				`a[href$="/nutrient-mappings/${pendingMappingId}"]`,
			),
		).toBeVisible();
		await expect(
			nutrientMappingGaps.locator(
				`a[href$="/nutrient-mappings/${resolvedMappingId}"]`,
			),
		).toHaveCount(0);

		await page.goto(
			`${dataOperationsPath}/nutrient-mappings/${pendingMappingId}`,
		);
		await waitForAppReady(page);
		const nutrientMappingSheet = page.getByRole("dialog", {
			name: "Review nutrient mapping",
		});
		await nutrientMappingSheet
			.getByRole("combobox", {
				name: "1. What does the evidence support?",
			})
			.click();
		await nutrientMappingSheet
			.getByRole("option", {
				name: "Approve — evidence proves an exact identity",
			})
			.click();
		const nutrientPicker = nutrientMappingSheet.getByRole("group", {
			name: "Confirmed nutrient",
		});
		const nutrientSearch = nutrientPicker.getByRole("searchbox", {
			name: "Find a compatible nutrient",
		});
		await nutrientSearch.fill("arachidonic");
		await expect(
			nutrientPicker.getByText(/1 of \d+ compatible nutrients match/u),
		).toBeVisible();
		await nutrientPicker
			.getByRole("button", { name: /arachidonic.*855.*G/iu })
			.click();
		await expect(nutrientPicker.getByText(/arachidonic · G$/iu)).toBeVisible();
		await nutrientSearch.fill("not-a-real-nutrient");
		await expect(
			nutrientPicker
				.getByRole("status")
				.filter({ hasText: "No compatible nutrient matches" }),
		).toContainText("Your current selection is unchanged");
		await expect(nutrientPicker.getByText(/arachidonic · G$/iu)).toBeVisible();
		await nutrientPicker
			.getByRole("button", { name: "Clear find a compatible nutrient" })
			.click();
		await expect(
			nutrientPicker.getByText(/\d+ compatible nutrients available/u),
		).toBeVisible();

		await page.goto(dataOperationsPath);
		const namedMissingNutrients = dataOperationsSheet.getByText(
			"A required nutrient is missing: Fatty acids, total saturated",
		);
		expect(await namedMissingNutrients.count()).toBeGreaterThan(0);
		await expect(namedMissingNutrients.first()).toBeVisible();
		await dataOperationsSheet
			.getByRole("link", { name: "Inspect first product" })
			.click();
		const productReadinessSheet = page.getByRole("dialog", {
			name: "Product readiness",
		});
		await expect(productReadinessSheet).toBeVisible();
		await expect(
			productReadinessSheet.getByText(
				"The product stays available in blendCalc.",
			),
		).toBeVisible();
		await expect(
			productReadinessSheet.getByText(
				"It stays withheld from public blendCalcAPI v1.",
			),
		).toBeVisible();
		await expect(
			productReadinessSheet.getByLabel(
				"Why can this product not be published yet?",
			),
		).toBeVisible();
		await expect(
			productReadinessSheet.getByRole("button", {
				name: "Finish review — keep out of public API",
			}),
		).toBeDisabled();
		const correctionLink = productReadinessSheet.getByRole("link", {
			name: "Open prefilled correction",
		});
		await expect(correctionLink).toBeVisible();
		await expect(productReadinessSheet).toContainText(
			"Opening it changes nothing; only an approved submission creates a new product revision.",
		);
		await correctionLink.click();
		const correctionSheet = page.getByRole("dialog", {
			name: "Correct Product Information",
		});
		await expect(correctionSheet).toBeVisible();
		await expect(
			correctionSheet.getByRole("link", {
				name: "Return to originating review",
			}),
		).toHaveAttribute(
			"href",
			/\/profile\/privileged-tools\/data-operations\/products\//,
		);
		await correctionSheet
			.getByRole("link", { name: "Return to originating review" })
			.click();
		await expect(
			page.getByRole("dialog", { name: "Product readiness" }),
		).toBeVisible();

		await page.goto(dataOperationsPath);
		await dataOperationsSheet
			.getByRole("button", { name: "About Data operations" })
			.click();
		const informationSheet = page.getByRole("dialog", {
			name: "About data operations",
		});
		await expect(
			informationSheet.getByRole("heading", { name: "When to use this" }),
		).toBeVisible();
		await expect(
			informationSheet.getByRole("heading", { name: "Done when" }),
		).toBeVisible();
		await informationSheet.getByRole("button", { name: "Got it" }).click();

		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(
			`${dataOperationsPath}/products/${diagnosticFixture.productId}`,
		);
		await waitForAppReady(page);
		const diagnosticSheet = page.getByRole("dialog", {
			name: "Product readiness",
		});
		await expect(
			diagnosticSheet.getByText(
				"This product is already public. The 1 item below improves internal evidence history only; none is keeping it out of blendCalcAPI v1.",
			),
		).toBeVisible();
		await expect(
			diagnosticSheet.getByRole("heading", {
				name: "Catalog evidence follow-up",
			}),
		).toBeVisible();
		await expect(
			diagnosticSheet.getByText("Revision 2 needs change evidence").first(),
		).toBeVisible();
		await expect(
			diagnosticSheet.getByText("Does not affect current API publication"),
		).toBeVisible();
		await expect(
			diagnosticSheet.getByRole("button", {
				name: "Finish review — keep out of public API",
			}),
		).toHaveCount(0);

		await diagnosticSheet
			.getByRole("link", { name: "Go to safe repair check" })
			.click();
		const repairTarget = diagnosticSheet
			.locator(".catalog-product-repairs__item")
			.filter({ hasText: "Revision 2 needs change evidence" });
		await expect(repairTarget).toBeFocused();
		await expect(repairTarget).toBeInViewport();
		const repairBox = await repairTarget.boundingBox();
		expect(repairBox?.y ?? -1).toBeGreaterThanOrEqual(0);
		expect((repairBox?.y ?? 0) + (repairBox?.height ?? 0)).toBeLessThanOrEqual(
			844,
		);
		await expect(
			repairTarget.getByText(
				"Checks Revision 2's stored change summary for exact field-by-field before and after values. It does not compare names or guess what changed.",
			),
		).toBeVisible();
		await repairTarget.getByRole("button", { name: "Check repair" }).click();
		await expect(repairTarget.getByText("No safe changes found")).toBeVisible();
		await repairTarget
			.getByRole("link", { name: "Go to final review" })
			.click();

		const evidenceReview = diagnosticSheet.locator("#finish-evidence-review");
		await expect(evidenceReview).toBeFocused();
		await expect(evidenceReview).toBeInViewport();
		await expect(
			evidenceReview.getByText(
				"Its current public blendCalcAPI v1 status does not change.",
			),
		).toBeVisible();
		const finishButton = evidenceReview.getByRole("button", {
			name: "Finish evidence follow-up",
		});
		await expect(finishButton).toBeDisabled();
		await evidenceReview
			.getByLabel("Why can this evidence not be reconstructed today?")
			.fill(
				"Revision 2 has no field summary, matching submission, or exact stored observation.",
			);
		await expect(finishButton).toBeEnabled();
		await finishButton.click();
		await expect(
			diagnosticSheet.getByText("Evidence follow-up finished", {
				exact: true,
			}),
		).toBeVisible();
		await expect(
			diagnosticSheet.getByText(
				"Product data and public API availability are unchanged.",
				{ exact: false },
			),
		).toBeVisible();

		await page.goto(dataOperationsPath);
		await waitForAppReady(page);
		await dataOperationsSheet
			.locator("summary")
			.filter({ hasText: "Revision history gaps" })
			.click();
		await expect(
			dataOperationsSheet.getByText("Jalapeno Sauce, Jalapeno"),
		).toHaveCount(0);

		await page.goto("/profile");
		await waitForAppReady(page);
		await page.getByRole("button", { name: /Admin tools/ }).click();
		const adminToolsSheet = page.getByRole("dialog", { name: "Admin tools" });
		await expect(
			adminToolsSheet
				.getByRole("button", { name: /Catalog data operations/ })
				.locator(".action-required-count-badge"),
		).toBeVisible();
		await expect(
			adminToolsSheet
				.getByRole("button", { name: /Account access/ })
				.locator(".action-required-count-badge"),
		).toHaveCount(0);
	} finally {
		try {
			await resetLocalQaDatasetImportEvidence("cnf-2026");
			try {
				await cleanupLocalQaCatalogDiagnosticReview();
			} finally {
				await deleteLocalQaPendingNutrientMapping(pendingMappingId);
			}
		} finally {
			await deleteLocalQaAuthenticatorFactorsForEmail(adminEmail);
		}
	}
});
