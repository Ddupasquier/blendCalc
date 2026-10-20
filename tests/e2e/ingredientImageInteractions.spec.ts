import type { Locator, Page, Route } from "@playwright/test";
import {
	expect,
	signInLocalQaAccount,
	test,
	waitForAppReady,
} from "./support/browserTest";
import { serveDeterministicOpenFoodFactsImages } from "./support/deterministicProviderImages";
import { expectPaintedMediaContainment } from "./support/ingredientCardContainment";

test.describe.configure({ mode: "serial" });

const moderatorEmail = "qa-moderator@blendcalc.local";

const representativeImageProducts = [
	{
		foodId: 2032704,
		name: "Roasted Onion & Garlic Pasta Sauce",
	},
	{
		foodId: 9100003,
		name: "Gochu Jang Hot & Sweet Chili Sauce",
	},
] as const;

test.beforeEach(async ({ page }) => {
	await serveDeterministicOpenFoodFactsImages(page);
});

test("@mobile ingredient cards use thumbnails while visible details prioritize the full image", async ({
	page,
}, testInfo) => {
	test.skip(
		!new Set(["desktop-chromium", "mobile-chromium"]).has(
			testInfo.project.name,
		),
		"Chromium desktop and compact layouts own image request selection and bounds.",
	);

	const product = representativeImageProducts[0];
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	const card = await findSavedIngredientCard(page, product.name);
	const cardImage = card.locator(".ingredient-card-media-lane img");
	await expect(cardImage).toHaveAttribute("src", /front_en\.5\.200\.jpg$/);
	await expect(cardImage).toHaveAttribute("loading", "lazy");
	await expect(cardImage).toHaveAttribute("fetchpriority", "auto");
	const cardBounds = await card.boundingBox();
	const mediaLaneBounds = await card
		.locator(".ingredient-card-media-lane")
		.boundingBox();
	expect(cardBounds).not.toBeNull();
	expect(mediaLaneBounds).not.toBeNull();
	expect(mediaLaneBounds!.x).toBeGreaterThanOrEqual(cardBounds!.x);
	expect(mediaLaneBounds!.y).toBeGreaterThanOrEqual(cardBounds!.y);
	expect(mediaLaneBounds!.x + mediaLaneBounds!.width).toBeLessThanOrEqual(
		cardBounds!.x + cardBounds!.width,
	);
	expect(mediaLaneBounds!.y + mediaLaneBounds!.height).toBeLessThanOrEqual(
		cardBounds!.y + cardBounds!.height,
	);

	const nutritionDetails = await openNutritionDetails(page, product);
	const detailImage = nutritionDetails.getByRole("img", {
		name: `${product.name} package image`,
	});
	await expect(detailImage).toHaveAttribute("src", /front_en\.5\.400\.jpg$/);
	await expect(detailImage).toHaveAttribute("loading", "eager");
	await expect(detailImage).toHaveAttribute("fetchpriority", "high");
	await expect(detailImage).toHaveAttribute("width", "288");
	await expect(detailImage).toHaveAttribute("height", "224");

	await page.goto("/mix");
	await waitForAppReady(page);
	await page
		.getByRole("searchbox", { name: "Find ingredients", exact: true })
		.fill(product.name);
	const mixOption = page
		.locator(".mix-ingredient-option")
		.filter({ hasText: product.name });
	await expect(mixOption).toBeVisible();
	const mixImage = mixOption.locator(".ingredient-card-media-lane img");
	await expect(mixImage).toHaveAttribute("src", /front_en\.5\.200\.jpg$/);
	await expect(mixImage).toHaveAttribute("loading", "lazy");
	await expect(mixImage).toHaveAttribute("fetchpriority", "auto");
});

const waitForSavedIngredientTarget = async ({
	page,
	productName,
	target,
}: {
	page: Page;
	productName: string;
	target: Locator;
}) => {
	const savedIngredientList = page.getByRole("list", {
		name: "Fridge ingredients",
	});
	const loadMoreButton = page.getByRole("button", { name: "Load more" });

	for (let attempt = 0; attempt < 10; attempt += 1) {
		await expect
			.poll(
				async () => {
					if (await target.isVisible().catch(() => false)) {
						return "target-visible";
					}
					if (!(await savedIngredientList.isVisible().catch(() => false))) {
						return "loading";
					}
					if (
						(await savedIngredientList.getAttribute("aria-busy")) === "true"
					) {
						return "loading";
					}
					if (!(await loadMoreButton.isVisible().catch(() => false))) {
						return "pagination-finished";
					}
					return (await loadMoreButton.isEnabled().catch(() => false))
						? "load-more-ready"
						: "loading";
				},
				{
					message: `Wait for ${productName} or the next stable pagination state`,
				},
			)
			.not.toBe("loading");

		if (await target.isVisible().catch(() => false)) return target;
		if (!(await loadMoreButton.isVisible().catch(() => false))) break;
		if ((await savedIngredientList.getAttribute("aria-busy")) === "true") {
			continue;
		}
		if (!(await loadMoreButton.isEnabled().catch(() => false))) continue;
		await loadMoreButton.click();
	}

	await expect(
		target,
		`${productName} should appear before pagination finishes`,
	).toBeVisible();
	return target;
};

const findSavedIngredientCard = async (page: Page, productName: string) => {
	const previewButton = page.getByRole("button", {
		name: `Preview ${productName}`,
		exact: true,
	});
	await waitForSavedIngredientTarget({
		page,
		productName,
		target: previewButton,
	});
	return page.locator(".saved-ingredient-card").filter({ has: previewButton });
};

const openNutritionDetails = async (
	page: Page,
	product: (typeof representativeImageProducts)[number],
) => {
	await page.goto(`/ingredients/fridge/nutrition/${product.foodId}`);
	await waitForAppReady(page);
	await expect(
		page.getByRole("heading", { name: product.name, level: 1 }),
	).toBeVisible();
	return page.locator(".nutrition-detail-view");
};

const openSavedIngredientActions = async (page: Page, productName: string) => {
	await page.goto("/ingredients/fridge");
	await waitForAppReady(page);
	const actionButton = page.getByRole("button", {
		name: `Open actions for ${productName}`,
		exact: true,
	});
	await waitForSavedIngredientTarget({
		page,
		productName,
		target: actionButton,
	});
	await actionButton.click();
	const dialog = page.getByRole("dialog", { name: productName });
	await expect(dialog).toBeVisible();
	return dialog;
};

const expectPlacementSummaryOrder = async (summary: Locator) => {
	await expect(summary.locator(".collapsible-section__chevron")).toHaveCount(1);
	await expect(summary.locator(".privileged-action-badge")).toHaveCount(1);
	expect(
		await summary.evaluate((element) => {
			const chevron = element.querySelector(".collapsible-section__chevron");
			const title = element.querySelector(".collapsible-section__title");
			const badge = element.querySelector(".privileged-action-badge");
			if (!chevron || !title || !badge) return false;
			return (
				Boolean(
					chevron.compareDocumentPosition(title) &
					Node.DOCUMENT_POSITION_FOLLOWING,
				) &&
				Boolean(
					title.compareDocumentPosition(badge) &
					Node.DOCUMENT_POSITION_FOLLOWING,
				)
			);
		}),
	).toBe(true);
};

const setRangeValue = async (slider: Locator, value: number) => {
	await slider.evaluate((element, nextValue) => {
		const input = element as HTMLInputElement;
		input.value = String(nextValue);
		input.dispatchEvent(new Event("input", { bubbles: true }));
		input.dispatchEvent(new Event("change", { bubbles: true }));
	}, value);
};

for (const placement of ["unplaced", "manual", "automatic"] as const) {
	test(`otherwise unplaced images fill cards while ${placement} geometry stays intentional @compatibility @mobile`, async ({
		page,
	}, testInfo) => {
		const pattern = "**/api/user-food-lists/fridge?**";
		const imagePattern = "**/qa/card-fallback-*.svg";
		const dimensions = [
			{ width: 40, height: 200 },
			{ width: 600, height: 100 },
		];
		let matchedFoods = 0;
		await page.route(imagePattern, (route) => {
			const index = representativeImageProducts.findIndex((product) =>
				route.request().url().endsWith(`card-fallback-${product.foodId}.svg`),
			);
			expect(index).toBeGreaterThanOrEqual(0);
			const { width, height } = dimensions[index];
			return route.fulfill({
				status: 200,
				contentType: "image/svg+xml",
				body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#d9b46f"/></svg>`,
			});
		});
		await page.route(pattern, async (route) => {
			const response = await route.fetch({ maxRedirects: 0 });
			expect(response.status()).toBe(200);
			const data = await response.json();
			data.foods = data.foods.map(
				(food: { fdcId: number; image?: Record<string, unknown> }) => {
					if (
						!representativeImageProducts.some(
							(product) => product.foodId === food.fdcId,
						)
					)
						return food;
					matchedFoods += 1;
					const imageUrl = new URL(
						`/qa/card-fallback-${food.fdcId}.svg`,
						route.request().url(),
					).href;
					return {
						...food,
						image: {
							...food.image,
							imageUrl,
							thumbnailUrl: imageUrl,
							cropX: 50,
							cropY: 50,
							cropZoom: placement === "automatic" ? 1.7 : 1,
							rotationDegrees: 0,
							placementVersion: 2,
							fitMode: placement === "automatic" ? "custom" : "contain",
							placementMethod:
								placement === "unplaced"
									? "default"
									: placement === "manual"
										? "manual"
										: "automatic-ocr",
							cropSource: placement === "manual" ? "user" : "source",
							approvedAt: undefined,
							approvedBy: undefined,
							suggestionAcceptedAt:
								placement === "automatic" ? "2026-01-01T00:00:00Z" : undefined,
							suggestionVersion:
								placement === "automatic" ? "qa-approved-placement" : undefined,
							suggestionConfidence: placement === "automatic" ? 99 : undefined,
						},
					};
				},
			);
			await route.fulfill({ response, json: data });
		});
		try {
			await page.goto("/ingredients/fridge");
			await waitForAppReady(page);
			// Initial foods are server-rendered and do not use the API fixture.
			// A real sort change requests authorized list data for every visible card.
			await page
				.getByRole("button", { name: "Filter and sort saved ingredients" })
				.click();
			const filters = page.getByRole("dialog", { name: "Filter and sort" });
			await filters
				.getByRole("button", { name: "Oldest first", exact: true })
				.click();
			const sortedResponse = page.waitForResponse((response) => {
				const url = new URL(response.url());
				return (
					url.pathname === "/api/user-food-lists/fridge" &&
					url.searchParams.get("sort") === "oldest" &&
					response.status() === 200
				);
			});
			await filters.getByRole("button", { name: "Apply", exact: true }).click();
			await sortedResponse;
			await expect(filters).toBeHidden();
			await expect(
				page.getByRole("list", { name: "Fridge ingredients" }),
			).toHaveAttribute("aria-busy", "false");
			for (const [index, product] of representativeImageProducts.entries()) {
				const card = await findSavedIngredientCard(page, product.name);
				const viewport = card.locator(".image-placement-viewport");
				await viewport.scrollIntoViewIfNeeded();
				await expect
					.poll(() =>
						viewport
							.locator("img")
							.evaluate((image: HTMLImageElement) => image.naturalWidth),
					)
					.toBe(dimensions[index].width);
				for (const width of [1024, 390]) {
					await page.setViewportSize({ width, height: 844 });
					for (const theme of ["light", "dark"]) {
						await page.locator("html").evaluate((element, value) => {
							element.dataset.theme = value;
						}, theme);
						await page.emulateMedia({ reducedMotion: "reduce" });
						await expect
							.poll(async () =>
								viewport.evaluate((element, mode) => {
									const frame = element.getBoundingClientRect();
									const image = element.querySelector("img")!;
									const bounds = image.getBoundingClientRect();
									if (mode === "unplaced")
										return (
											bounds.left <= frame.left + 1 &&
											bounds.right >= frame.right - 1 &&
											bounds.top <= frame.top + 1 &&
											bounds.bottom >= frame.bottom - 1
										);
									const scale =
										Math.min(
											frame.width / image.naturalWidth,
											frame.height / image.naturalHeight,
										) * (mode === "automatic" ? 1.7 : 1);
									return (
										Math.abs(bounds.width - image.naturalWidth * scale) <= 1 &&
										Math.abs(bounds.height - image.naturalHeight * scale) <= 1
									);
								}, placement),
							)
							.toBe(true);
						await expect
							.poll(() =>
								page.evaluate(
									() =>
										document.documentElement.scrollWidth <=
										document.documentElement.clientWidth + 1,
								),
							)
							.toBe(true);
					}
				}
				await card.screenshot({
					path: testInfo.outputPath(`card-${product.foodId}-${placement}.png`),
				});
			}
			expect(matchedFoods).toBeGreaterThanOrEqual(2);
		} finally {
			await page.unroute(pattern);
			await page.unroute(imagePattern);
		}
	});
}

test("normal users can personalize images without moderator publishing controls", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One primary browser owns the role boundary.",
	);
	const product = representativeImageProducts[0];
	const details = await openNutritionDetails(page, product);
	await details
		.getByText("Adjust card image placement", { exact: true })
		.click();
	await expect(
		details.getByRole("button", { name: "Save for me", exact: true }),
	).toBeVisible();
	await expect(
		details.getByRole("button", { name: "Suggest for everyone", exact: true }),
	).toBeVisible();
	await expect(
		details.getByRole("button", {
			name: "Publish shared placement",
			exact: true,
		}),
	).toHaveCount(0);
	const actions = await openSavedIngredientActions(page, product.name);
	await expect(
		actions.getByRole("button", { name: "Adjust image placement" }),
	).toBeVisible();
	await expect(
		actions.getByRole("region", { name: "Privileged tools" }),
	).toHaveCount(0);
});

test("moderator publishing stays separate from personal image placement", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One isolated primary project owns the moderator fixture.",
	);
	await signInLocalQaAccount({
		page,
		email: moderatorEmail,
		nextPath: "/ingredients/fridge",
	});
	const product = representativeImageProducts[0];
	const details = await openNutritionDetails(page, product);
	const placement = details.locator("details.product-image-panel__placement");
	await expect(placement).toHaveCount(1);
	await expect(placement).not.toHaveAttribute("open", "");
	await placement.locator(":scope > summary").click();
	await expect(
		placement.getByRole("button", { name: "Save for me", exact: true }),
	).toBeVisible();
	const moderatorControls = placement.locator("details").filter({
		has: page.locator("summary", { hasText: "Moderator controls" }),
	});
	await expect(moderatorControls).not.toHaveAttribute("open", "");
	await expectPlacementSummaryOrder(
		moderatorControls.locator(":scope > summary"),
	);
	await moderatorControls.locator(":scope > summary").click();
	await expect(
		moderatorControls.getByRole("button", { name: "Publish shared placement" }),
	).toBeVisible();
	const actions = await openSavedIngredientActions(page, product.name);
	await actions.getByRole("button", { name: "Adjust image placement" }).click();
	const sheet = page.getByRole("dialog", { name: "Adjust image placement" });
	await expect(
		sheet.getByRole("button", { name: "Save for me", exact: true }),
	).toBeVisible();
	await expect(
		sheet.locator("details.product-image-panel__placement"),
	).toHaveCount(0);
	await expect(
		sheet.getByText("Moderator controls", { exact: true }),
	).toBeVisible();
});

test("one placement save shows pending feedback and sends one request", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One isolated Chromium project owns the shared moderator save fixture.",
	);
	const product = representativeImageProducts[0];
	const nutritionPath = `/ingredients/fridge/nutrition/${product.foodId}`;
	let slowPlacementSave: ((route: Route) => Promise<void>) | null = null;
	let releasePlacementSave = () => {};

	try {
		await signInLocalQaAccount({
			page,
			email: moderatorEmail,
			nextPath: nutritionPath,
		});
		await expect(page).toHaveURL((url) => url.pathname === nutritionPath);
		await waitForAppReady(page);
		const originalImage = await page.evaluate(async (foodId) => {
			const response = await fetch(
				"/api/user-food-lists/fridge?limit=100&offset=0&sort=recent&source=all&trust=any",
			);
			if (!response.ok) throw new Error("Could not read the product image.");
			const data = (await response.json()) as {
				foods?: Array<{
					fdcId?: number;
					image?: Record<string, unknown>;
				}>;
			};
			const image = data.foods?.find((food) => food.fdcId === foodId)?.image;
			if (!image) throw new Error("The QA product image was unavailable.");
			return image;
		}, product.foodId);

		const targetZoom = 1.65;
		const targetVerticalPosition = 35;
		const targetHorizontalShift = 45;
		const targetCropX = 50 + targetHorizontalShift / 2;
		const savedPlacement = {
			cropX: targetCropX,
			cropY: targetVerticalPosition,
			cropZoom: targetZoom,
			fitMode: "custom",
		};

		const nutritionDetails = page.locator(".nutrition-detail-view");
		await expect(
			nutritionDetails.getByRole("img", {
				name: `${product.name} package image`,
			}),
		).toBeVisible();
		await expect(
			nutritionDetails.locator(
				".product-image-frame .image-placement-viewport",
			),
		).toHaveCount(0);

		const placementDetails = nutritionDetails.locator(
			"details.product-image-panel__placement",
		);
		await placementDetails.locator(":scope > summary").click();
		const placementEditor = placementDetails.getByRole("region", {
			name: "Card image placement",
		});
		await setRangeValue(
			placementEditor.getByRole("slider", { name: "Image zoom" }),
			targetZoom,
		);
		const horizontalShift = placementEditor.getByRole("slider", {
			name: "Shift image left",
		});
		await setRangeValue(horizontalShift, 80);
		await setRangeValue(horizontalShift, targetHorizontalShift);
		const verticalPosition = placementEditor.getByRole("slider", {
			name: "Vertical image position",
		});
		await expect(verticalPosition).toBeEnabled();
		await setRangeValue(verticalPosition, targetVerticalPosition);

		const placementRequests: Array<Record<string, unknown>> = [];
		const placementSaveGate = new Promise<void>((resolve) => {
			releasePlacementSave = () => resolve();
		});
		slowPlacementSave = async (route) => {
			const placementRequest = route.request().postDataJSON() as Record<
				string,
				unknown
			>;
			placementRequests.push(placementRequest);
			await placementSaveGate;
			await route.fulfill({
				contentType: "application/json",
				body: JSON.stringify({
					status: "personal_saved",
					placement: placementRequest.placement,
					sharedPlacement: originalImage,
					revision: originalImage.placementRevision,
					locked: false,
				}),
				status: 200,
			});
		};
		await page.route("**/api/food-images/placement", slowPlacementSave);

		const saveButton = placementDetails.locator(
			".product-image-panel__placement-save button[type='submit']",
		);
		await saveButton.evaluate((button) =>
			(button as HTMLButtonElement).click(),
		);
		await expect(saveButton).toHaveAttribute("aria-busy", "true");
		await expect(saveButton).toBeDisabled();
		await expect(saveButton).toContainText("Saving image placement…");
		releasePlacementSave();
		releasePlacementSave = () => {};
		await expect(
			placementDetails.getByText(
				"Saved for your account. Everyone else’s view stays the same.",
			),
		).toBeVisible();
		expect(placementRequests).toHaveLength(1);
		expect(placementRequests[0]).toMatchObject({
			action: "personal",
			placement: savedPlacement,
		});
		await page.unroute("**/api/food-images/placement", slowPlacementSave);
		slowPlacementSave = null;
	} finally {
		releasePlacementSave();
		if (slowPlacementSave) {
			await page
				.unroute("**/api/food-images/placement", slowPlacementSave)
				.catch(() => undefined);
		}
	}
});

test("saved placement crops the card image but not the nutrition detail image", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One isolated Chromium project owns the saved placement rendering proof.",
	);
	const product = representativeImageProducts[0];
	const nutritionPath = `/ingredients/fridge/nutrition/${product.foodId}`;
	const savedPlacement = {
		cropX: 72.5,
		cropY: 35,
		cropZoom: 1.65,
		fitMode: "custom",
	};
	let savedFridgeResponse: ((route: Route) => Promise<void>) | null = null;

	try {
		savedFridgeResponse = async (route) => {
			const response = await route.fetch();
			const data = (await response.json()) as {
				foods?: Array<{
					fdcId?: number;
					image?: Record<string, unknown>;
				}>;
			};
			await route.fulfill({
				response,
				json: {
					...data,
					foods: data.foods?.map((food) =>
						food.fdcId === product.foodId
							? {
									...food,
									image: { ...food.image, ...savedPlacement },
								}
							: food,
					),
				},
			});
		};
		await page.route("**/api/user-food-lists/fridge?**", savedFridgeResponse);
		await signInLocalQaAccount({
			page,
			email: moderatorEmail,
			nextPath: "/ingredients/fridge",
		});
		await waitForAppReady(page);

		const savedCard = page
			.getByRole("button", {
				name: new RegExp(`^Preview ${product.name}`),
			})
			.locator("..");
		await expect(savedCard).toBeVisible();
		await expect(
			savedCard.locator(".ingredient-card-media-lane img"),
		).toBeVisible();
		await expectPaintedMediaContainment(savedCard);
		expect(
			await savedCard
				.locator(".ingredient-card-media-lane")
				.evaluate((lane) => {
					const laneBounds = lane.getBoundingClientRect();
					const imageBounds = lane
						.querySelector("img")
						?.getBoundingClientRect();
					return Boolean(
						imageBounds && imageBounds.left <= laneBounds.left + 1,
					);
				}),
		).toBe(true);

		await savedCard
			.getByRole("button", { name: new RegExp(`^Preview ${product.name}`) })
			.click();
		await expect(page).toHaveURL((url) => url.pathname === nutritionPath);
		await expect(
			page.locator(
				".nutrition-detail-view .product-image-frame .product-image-frame__image",
			),
		).toBeVisible();
		await expect(
			page.locator(
				".nutrition-detail-view .product-image-frame .image-placement-viewport",
			),
		).toHaveCount(0);
	} finally {
		if (savedFridgeResponse) {
			await page
				.unroute("**/api/user-food-lists/fridge?**", savedFridgeResponse)
				.catch(() => undefined);
		}
	}
});

test("placement controls update the exact card preview within safe movement bounds", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One primary browser proves the deterministic placement-control geometry.",
	);
	const product = representativeImageProducts[0];
	await signInLocalQaAccount({
		page,
		email: "qa-moderator@blendcalc.local",
		nextPath: `/ingredients/fridge/nutrition/${product.foodId}`,
	});

	const nutritionDetails = await openNutritionDetails(page, product);
	const placementDetails = nutritionDetails.locator(
		"details.product-image-panel__placement",
	);
	await placementDetails.locator(":scope > summary").click();
	const placementEditor = placementDetails.getByRole("region", {
		name: "Card image placement",
	});
	const preview = placementEditor.getByRole("group", {
		name: "Interactive card image preview",
	});
	const previewImage = preview.locator(
		".image-placement-viewport__image--current",
	);
	await expect(previewImage).toBeVisible();
	await expect
		.poll(() =>
			previewImage.evaluate(
				(image) => (image as HTMLImageElement).naturalWidth,
			),
		)
		.toBeGreaterThan(0);
	await expectPaintedMediaContainment(preview);

	const restoreButton = placementEditor.getByRole("button", {
		name: "Restore default",
	});
	const shiftSlider = placementEditor.getByRole("slider", {
		name: "Shift image left",
	});
	const verticalSlider = placementEditor.getByRole("slider", {
		name: "Vertical image position",
	});
	const zoomSlider = placementEditor.getByRole("slider", {
		name: "Image zoom",
	});
	await restoreButton.click();
	await expect(shiftSlider).toBeEnabled();
	await expect(verticalSlider).toBeDisabled();
	await expect(zoomSlider).toBeEnabled();

	const defaultGeometry = await preview.evaluate((element) => {
		const previewBounds = element.getBoundingClientRect();
		const editorBounds = element
			.closest(".image-placement-editor")
			?.getBoundingClientRect();
		const lane = element.querySelector<HTMLElement>(
			".ingredient-card-media-lane",
		);
		const image = element.querySelector<HTMLImageElement>(
			".image-placement-viewport__image--current",
		);
		const copy = element.querySelector<HTMLElement>(
			".image-placement-card-preview__copy",
		);
		if (!editorBounds || !lane || !image || !copy) return null;
		const laneBounds = lane.getBoundingClientRect();
		const imageBounds = image.getBoundingClientRect();
		const copyBounds = copy.getBoundingClientRect();
		const previewStyle = getComputedStyle(element);
		return {
			containerInlineSize:
				previewBounds.width -
				Number.parseFloat(previewStyle.paddingLeft) -
				Number.parseFloat(previewStyle.paddingRight) -
				Number.parseFloat(previewStyle.borderLeftWidth) -
				Number.parseFloat(previewStyle.borderRightWidth),
			copyOffset: copyBounds.left - previewBounds.left,
			imageHeight: imageBounds.height,
			imageLeft: imageBounds.left,
			laneLeft: laneBounds.left,
			laneWidth: laneBounds.width,
			maskImage: getComputedStyle(lane).maskImage,
			previewWidth: previewBounds.width,
			editorWidth: editorBounds.width,
		};
	});
	expect(defaultGeometry).not.toBeNull();
	expect(defaultGeometry?.previewWidth).toBeCloseTo(
		defaultGeometry?.editorWidth ?? 0,
		0,
	);
	expect(defaultGeometry?.laneWidth).toBeCloseTo(
		(defaultGeometry?.containerInlineSize ?? 0) * 0.28,
		0,
	);
	expect(defaultGeometry?.copyOffset).toBeLessThan(
		(defaultGeometry?.previewWidth ?? 0) * 0.28,
	);
	expect(defaultGeometry?.maskImage).toContain("radial-gradient");
	expect(defaultGeometry?.imageLeft).toBeCloseTo(
		defaultGeometry?.laneLeft ?? 0,
		0,
	);

	await setRangeValue(shiftSlider, 100);
	await expect
		.poll(() =>
			previewImage.evaluate((image) => image.getBoundingClientRect().left),
		)
		.toBeLessThan((defaultGeometry?.imageLeft ?? 0) - 1);

	await setRangeValue(zoomSlider, 4);
	await expect
		.poll(() =>
			previewImage.evaluate((image) => image.getBoundingClientRect().height),
		)
		.toBeGreaterThan((defaultGeometry?.imageHeight ?? 0) + 1);
	await expect(verticalSlider).toBeEnabled();
	const zoomedTop = await previewImage.evaluate(
		(image) => image.getBoundingClientRect().top,
	);
	await setRangeValue(verticalSlider, 20);
	await expect
		.poll(() =>
			previewImage.evaluate((image) => image.getBoundingClientRect().top),
		)
		.not.toBeCloseTo(zoomedTop, 0);
	await expectPaintedMediaContainment(preview);
});
