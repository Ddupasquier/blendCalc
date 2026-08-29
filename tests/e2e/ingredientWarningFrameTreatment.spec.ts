import type { Locator, Page } from "@playwright/test";
import {
	expect,
	signInLocalQaAccount,
	test,
	waitForAppReady,
} from "./support/browserTest";

const preferenceQaEmail =
	process.env.BLENDCALC_TEST_PREFERENCES_EMAIL ??
	"qa-preferences@blendcalc.local";

const serveDeterministicOpenFoodFactsImages = (page: Page) =>
	page.route("https://images.openfoodfacts.org/**", (route) =>
		route.fulfill({
			status: 200,
			contentType: "image/svg+xml",
			body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160"><rect width="240" height="160" fill="#d9b46f"/><rect x="28" y="20" width="184" height="120" rx="12" fill="#f7f1e4"/><text x="120" y="90" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#2f3440">QA label</text></svg>',
		}),
	);

const getIngredientList = (page: Page, label: "Fridge" | "Shopping List") =>
	page.getByRole("list", { name: `${label} ingredients` });

const openMixSection = async (page: Page, selector: string) => {
	const section = page.locator(selector);
	const details = section.locator(":scope > details");
	if ((await details.getAttribute("open")) === null) {
		await details.locator(":scope > summary").click();
	}
	await expect(details).toHaveAttribute("open", "");
	return section;
};

const focusCardWithKeyboard = async (
	page: Page,
	target: Locator,
	allowWebkitKeyboardPreferenceFallback: boolean,
) => {
	for (let tabIndex = 0; tabIndex < 30; tabIndex += 1) {
		await page.keyboard.press("Tab");
		if (
			await target.evaluate((element) => element === document.activeElement)
		) {
			return;
		}
	}
	if (allowWebkitKeyboardPreferenceFallback) {
		await target.focus();
		return;
	}
	throw new Error("Keyboard traversal did not reach the warning card.");
};

const expectRoundedGradientFrame = async (
	card: Locator,
	tone: "danger" | "warning",
) => {
	await expect(card).toBeVisible();
	await expect(card).toHaveAttribute("data-warning-tone", tone);
	const frame = card.locator(".card-warning-frame");
	await expect(frame).toHaveAttribute("data-tone", tone);

	const treatment = await frame.evaluate((element) => {
		const frameStyles = getComputedStyle(element);
		const card = element.parentElement;
		const cardStyles = card ? getComputedStyle(card) : null;

		return {
			backgroundLayerCount:
				frameStyles.backgroundImage.match(/linear-gradient/g)?.length ?? 0,
			borderWidthPixels: Number.parseFloat(frameStyles.borderLeftWidth),
			cardBorderWidthPixels: Number.parseFloat(
				cardStyles?.borderLeftWidth ?? "0",
			),
			borderRadiusPixels: Number.parseFloat(frameStyles.borderTopLeftRadius),
			solidColorStop: frameStyles
				.getPropertyValue("--card-warning-frame-solid-stop")
				.trim(),
			fadeMidpoint: frameStyles
				.getPropertyValue("--card-warning-frame-fade-midpoint")
				.trim(),
			fadeEnd: frameStyles
				.getPropertyValue("--card-warning-frame-fade-end")
				.trim(),
			warningColor: frameStyles
				.getPropertyValue("--card-warning-frame-color")
				.trim(),
			hasHorizontalOverflow: card
				? card.scrollWidth > card.clientWidth + 1
				: true,
		};
	});

	expect(treatment.backgroundLayerCount).toBe(1);
	expect(treatment.borderWidthPixels).toBe(3);
	expect(treatment.cardBorderWidthPixels).toBe(3);
	expect(treatment.borderRadiusPixels).toBeGreaterThan(0);
	expect(treatment.solidColorStop).toBe("16%");
	expect(treatment.fadeMidpoint).toBe("32%");
	expect(treatment.fadeEnd).toBe("55%");
	expect(treatment.warningColor).not.toBe("");
	expect(treatment.hasHorizontalOverflow).toBe(false);
	return treatment;
};

const readCardMediaPresentation = (card: Locator) =>
	card.locator(".ingredient-card-media-lane").evaluate((mediaLane) => {
		const card = mediaLane.parentElement;
		const cardBounds = card?.getBoundingClientRect();
		const mediaBounds = mediaLane.getBoundingClientRect();
		const image = mediaLane.querySelector("img");
		const imageBounds = image?.getBoundingClientRect();
		const maskHorizontalRadiusPixels = Number.parseFloat(
			getComputedStyle(mediaLane).getPropertyValue(
				"--ingredient-card-media-mask-horizontal-radius",
			),
		);
		const maskImage = getComputedStyle(mediaLane).maskImage;
		const maskFadeEndPixels = maskHorizontalRadiusPixels * 0.8;
		return {
			cardHeight: cardBounds?.height ?? 0,
			mediaHeight: mediaBounds.height,
			mediaWidthRatio:
				cardBounds && cardBounds.width > 0
					? mediaBounds.width / cardBounds.width
					: 0,
			maskGradientTemplate: maskImage.replace(
				/radial-gradient\([\d.]+px/,
				"radial-gradient(<horizontal-radius>",
			),
			imageSource: image?.getAttribute("src") ?? "",
			imageRightEdgePixels: imageBounds
				? imageBounds.right - mediaBounds.left
				: 0,
			imageLeftEdgePixels: imageBounds
				? imageBounds.left - mediaBounds.left
				: 0,
			imageWidthPixels: imageBounds?.width ?? 0,
			imageHeightPixels: imageBounds?.height ?? 0,
			maskFadeEndPixels,
			maskFadeEndRatio:
				mediaBounds.width > 0 ? maskFadeEndPixels / mediaBounds.width : 0,
		};
	});

test("Fridge and Shopping warning frames stay rounded, semantic, and interactive @compatibility @mobile", async ({
	page,
}, testInfo) => {
	const standardAccountBrowserState = await page.context().storageState();
	await signInLocalQaAccount({
		page,
		email: preferenceQaEmail,
		nextPath: "/ingredients/fridge",
	});

	const fridge = getIngredientList(page, "Fridge");
	const preferenceWarningCard = fridge
		.locator('.saved-ingredient-card--warning[data-warning-tone="warning"]')
		.first();
	const recallCard = fridge
		.locator('.saved-ingredient-card--warning[data-warning-tone="danger"]')
		.first();

	const preferenceFrame = await expectRoundedGradientFrame(
		preferenceWarningCard,
		"warning",
	);
	const recallFrame = await expectRoundedGradientFrame(recallCard, "danger");
	await expect(
		fridge
			.locator(".saved-ingredient-card--warning")
			.filter({ has: page.locator(".ingredient-card-media-lane") })
			.first(),
	).toBeVisible();

	expect(recallFrame.warningColor).not.toBe(preferenceFrame.warningColor);

	await page.locator("html").evaluate((element) => {
		element.dataset.theme = "dark";
	});
	await expectRoundedGradientFrame(preferenceWarningCard, "warning");
	await expectRoundedGradientFrame(recallCard, "danger");

	const cardAction = preferenceWarningCard.locator(
		".saved-ingredient-card__select",
	);
	await focusCardWithKeyboard(
		page,
		cardAction,
		testInfo.project.name.includes("webkit"),
	);
	await expect(cardAction).toBeFocused();
	expect(
		await cardAction.evaluate(
			(element) => getComputedStyle(element, "::before").borderStyle,
		),
	).toBe("solid");

	await page.getByRole("button", { name: "Select items" }).click();
	await cardAction.click();
	await expect(preferenceWarningCard).toHaveClass(
		/saved-ingredient-card--checked/,
	);
	await expectRoundedGradientFrame(preferenceWarningCard, "warning");
	await page.getByRole("button", { name: "Cancel" }).click();

	await page.getByRole("tab", { name: /Shopping List/ }).click();
	await expect(page).toHaveURL(/\/ingredients\/shopping$/);
	await expectRoundedGradientFrame(
		getIngredientList(page, "Shopping List")
			.locator(".saved-ingredient-card--warning")
			.first(),
		"warning",
	);

	await page.context().clearCookies();
	await page.context().addCookies(standardAccountBrowserState.cookies);
	await page.goto("/ingredients/fridge");
	await page.locator("html").evaluate((element) => {
		element.dataset.theme = "system";
	});
	await waitForAppReady(page);
	const standardFridge = getIngredientList(page, "Fridge");
	const standardCard = standardFridge.locator(".saved-ingredient-card").first();
	await expect(standardCard).toBeVisible();
	await expect(
		standardFridge.locator(".saved-ingredient-card--warning"),
	).toHaveCount(0);
	expect(
		await standardCard.evaluate((element) =>
			Number.parseFloat(getComputedStyle(element).borderLeftWidth),
		),
	).toBe(3);
});

test("search and Mix cards use the same warning frame @compatibility", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One primary browser proves each shared card integration; the frame itself runs in every compatibility project.",
	);
	await serveDeterministicOpenFoodFactsImages(page);

	await signInLocalQaAccount({
		page,
		email: preferenceQaEmail,
		nextPath: "/ingredients/fridge",
	});
	const recallSavedCard = getIngredientList(page, "Fridge")
		.locator('.saved-ingredient-card--warning[data-warning-tone="danger"]')
		.first();
	await expectRoundedGradientFrame(recallSavedCard, "danger");
	const picturedWarningCard = getIngredientList(page, "Fridge")
		.locator(".saved-ingredient-card--warning")
		.filter({ has: page.locator(".ingredient-card-media-lane img") })
		.first();
	await expect(picturedWarningCard).toBeVisible();
	const picturedWarningTone =
		await picturedWarningCard.getAttribute("data-warning-tone");
	expect(["danger", "warning"]).toContain(picturedWarningTone);
	const picturedFoodName = await picturedWarningCard
		.locator("strong")
		.innerText();
	await expect
		.poll(
			async () =>
				(await readCardMediaPresentation(picturedWarningCard))
					.maskFadeEndPixels,
		)
		.not.toBeNaN();
	const savedCardMedia = await readCardMediaPresentation(picturedWarningCard);
	expect(savedCardMedia.maskFadeEndPixels).toBeLessThanOrEqual(
		savedCardMedia.imageRightEdgePixels - 2.5,
	);

	await page.goto("/ingredients/fridge/search");
	await waitForAppReady(page);

	const ingredientSearch = page.getByRole("combobox", {
		name: "Search ingredients",
	});
	await ingredientSearch.fill("ground beef");
	const searchCard = page
		.locator(".ingredient-search-card--warning")
		.filter({ hasText: "Ground Beef" })
		.first();
	await expectRoundedGradientFrame(searchCard, "warning");

	await page.goto("/mix");
	await waitForAppReady(page);
	const chooser = await openMixSection(page, ".ingredient-chooser");
	const chooserSearch = chooser.getByRole("searchbox", {
		name: "Find ingredients",
	});
	await chooserSearch.fill("ground beef");
	const optionCard = chooser
		.locator(".mix-ingredient-option--warning")
		.filter({ hasText: "Ground Beef" })
		.first();
	await expectRoundedGradientFrame(optionCard, "warning");

	await chooserSearch.fill(picturedFoodName);
	const recalledOptionCard = chooser
		.locator(
			`.mix-ingredient-option--warning[data-warning-tone="${picturedWarningTone}"]`,
		)
		.filter({ hasText: picturedFoodName })
		.first();
	await expectRoundedGradientFrame(
		recalledOptionCard,
		picturedWarningTone as "danger" | "warning",
	);
	const mixCardMedia = await readCardMediaPresentation(recalledOptionCard);
	await expect(
		recalledOptionCard.locator(".ingredient-card-media-lane"),
	).toBeVisible();
	expect(mixCardMedia.cardHeight).toBeCloseTo(savedCardMedia.cardHeight, 0);
	expect(mixCardMedia.mediaHeight).toBeCloseTo(savedCardMedia.mediaHeight, 0);
	expect(mixCardMedia.mediaWidthRatio).toBeCloseTo(
		savedCardMedia.mediaWidthRatio,
		2,
	);
	expect(mixCardMedia.maskGradientTemplate).toBe(
		savedCardMedia.maskGradientTemplate,
	);
	expect(mixCardMedia.imageSource).toBe(savedCardMedia.imageSource);
	expect(mixCardMedia.imageLeftEdgePixels).toBeCloseTo(
		savedCardMedia.imageLeftEdgePixels,
		1,
	);
	expect(mixCardMedia.imageWidthPixels).toBeCloseTo(
		savedCardMedia.imageWidthPixels,
		2,
	);
	expect(mixCardMedia.imageHeightPixels).toBeCloseTo(
		savedCardMedia.imageHeightPixels,
		2,
	);
	expect(mixCardMedia.maskFadeEndRatio).toBeCloseTo(
		savedCardMedia.maskFadeEndRatio,
		2,
	);
});
