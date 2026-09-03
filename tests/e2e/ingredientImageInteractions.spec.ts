import type { Locator, Page } from "@playwright/test";
import {
	expect,
	signInLocalQaAccount,
	test,
	waitForAppReady,
} from "./support/browserTest";

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
		email: "qa-moderator@blendcalc.local",
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
		.poll(() => previewImage.evaluate((image) => image.naturalWidth))
		.toBeGreaterThan(0);

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
});
