import type { Locator, Page, Route } from "@playwright/test";
import {
	expect,
	signInLocalQaAccount,
	test,
	waitForAppReady,
} from "./support/browserTest";

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
	for (
		let attempt = 0;
		attempt < 10 && !(await actionButton.isVisible().catch(() => false));
		attempt += 1
	) {
		const loadMoreButton = page.getByRole("button", { name: "Load more" });
		if (!(await loadMoreButton.isVisible().catch(() => false))) break;
		await expect
			.poll(async () => {
				if (await actionButton.isVisible().catch(() => false)) {
					return "target-visible";
				}
				if (!(await loadMoreButton.isVisible().catch(() => false))) {
					return "pagination-finished";
				}
				return (await loadMoreButton.isEnabled().catch(() => false))
					? "ready"
					: "loading";
			})
			.not.toBe("loading");
		if (await actionButton.isVisible().catch(() => false)) break;
		if (!(await loadMoreButton.isVisible().catch(() => false))) break;
		await loadMoreButton.click();
	}
	await expect(actionButton).toBeVisible();
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

test("normal users see source images without privileged placement controls", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One primary browser proves the role-based image-control boundary.",
	);

	for (const product of representativeImageProducts) {
		const nutritionDetails = await openNutritionDetails(page, product);
		await expect(
			nutritionDetails.getByRole("img", {
				name: `${product.name} package image`,
			}),
		).toBeVisible();
		await expect(
			nutritionDetails.getByText("Adjust card image placement"),
		).toHaveCount(0);

		const actionDialog = await openSavedIngredientActions(page, product.name);
		await expect(
			actionDialog.getByRole("button", { name: "Adjust image placement" }),
		).toHaveCount(0);
		await expect(
			actionDialog.getByRole("region", { name: "Privileged tools" }),
		).toHaveCount(0);
		await actionDialog.getByRole("button", { name: "Close sheet" }).click();
	}
});

test("moderator image placement controls stay grouped, singular, and last", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One isolated Chromium project owns the shared moderator persona.",
	);
	await signInLocalQaAccount({
		page,
		email: moderatorEmail,
		nextPath: "/ingredients/fridge",
	});

	for (const product of representativeImageProducts) {
		const nutritionDetails = await openNutritionDetails(page, product);
		const disclosureGroup = nutritionDetails.locator(
			".nutrition-panel__disclosures",
		);
		const disclosures = disclosureGroup.locator("details");
		const placementDetails = disclosureGroup.locator(
			"details.product-image-panel__placement",
		);
		const placementSummary = placementDetails.locator(":scope > summary");
		await expect(placementDetails).toHaveCount(1);
		await expect(placementSummary).toContainText("Adjust card image placement");
		expect(
			await placementDetails.evaluate((element) => {
				const panel = element.closest(".product-image-panel");
				return Boolean(
					panel && panel.parentElement?.lastElementChild === panel,
				);
			}),
		).toBe(true);
		expect(
			await disclosures.evaluateAll((elements) =>
				elements.every((element) => !(element as HTMLDetailsElement).open),
			),
		).toBe(true);
		await expectPlacementSummaryOrder(placementSummary);

		await placementSummary.click();
		await expect(placementDetails).toHaveAttribute("open", "");
		await expect(
			placementDetails.getByRole("group", {
				name: "Interactive card image preview",
			}),
		).toBeVisible();
		const saveButton = placementDetails.getByRole("button", {
			name: "Save image placement",
		});
		await expect(saveButton).toBeVisible();
		await expect(saveButton.locator(".privileged-action-badge")).toHaveCount(0);
		await expect(
			placementDetails.locator(".privileged-action-badge"),
		).toHaveCount(1);

		const actionDialog = await openSavedIngredientActions(page, product.name);
		const privilegedGroup = actionDialog.getByRole("region", {
			name: "Privileged tools",
		});
		const adjustAction = privilegedGroup.getByRole("button", {
			name: "Adjust image placement",
		});
		await expect(privilegedGroup).toBeVisible();
		await expect(
			privilegedGroup.locator(".privileged-action-badge"),
		).toHaveCount(1);
		await expect(adjustAction.locator(".privileged-action-badge")).toHaveCount(
			0,
		);
		expect(
			await actionDialog.evaluate((element) => {
				const removeAction = Array.from(
					element.querySelectorAll("button"),
				).find((button) => button.textContent?.includes("Remove from Fridge"));
				const group = element.querySelector(".privileged-action-group");
				return Boolean(
					removeAction &&
					group &&
					removeAction.compareDocumentPosition(group) &
						Node.DOCUMENT_POSITION_FOLLOWING,
				);
			}),
		).toBe(true);

		await adjustAction.click();
		const placementDialog = page.getByRole("dialog", {
			name: "Adjust image placement",
		});
		await expect(placementDialog).toBeVisible();
		await expect(placementDialog.locator("details")).toHaveCount(0);
		await expect(
			placementDialog.getByRole("group", {
				name: "Interactive card image preview",
			}),
		).toBeVisible();
		await expect(
			placementDialog.getByRole("button", { name: "Save image placement" }),
		).toBeVisible();
		await placementDialog.getByRole("button", { name: "Close sheet" }).click();
	}
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
					image: { ...originalImage, ...placementRequest },
				}),
				status: 200,
			});
		};
		await page.route("**/api/food-images/crop", slowPlacementSave);

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
			placementDetails.getByText("Your card image placement is saved."),
		).toBeVisible();
		expect(placementRequests).toHaveLength(1);
		expect(placementRequests[0]).toMatchObject(savedPlacement);
		await page.unroute("**/api/food-images/crop", slowPlacementSave);
		slowPlacementSave = null;
	} finally {
		releasePlacementSave();
		if (slowPlacementSave) {
			await page
				.unroute("**/api/food-images/crop", slowPlacementSave)
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
