import { expect, test, waitForAppReady } from "./support/browserTest";
import type { Locator } from "@playwright/test";
import { getAuthenticatedLocalQaDatabaseClient } from "./support/localQaDatabase";
import {
	readApprovedManualEntryNutrientCatalog,
	type ExpectedManualEntryNutrientGroup,
} from "./support/localManualEntryNutrientCatalog";

const canonicalCategoryDisplayTestName = "Canonical Category Display Test";
const canonicalCategoryDisplayTestNameKey =
	canonicalCategoryDisplayTestName.toLocaleLowerCase("en-US");
const expectedManualEntryReferenceDataUnavailableMessage =
	"Nutrition tools couldn’t load. Refresh and try again before continuing.";
const listMembershipTestBarcode = "04006381333931";
const listMembershipTestFoodId = -9_280_001;
const optionalPhotoProductBarcode = "00030000581728";
const optionalPhotoProductDraft = {
	barcode: optionalPhotoProductBarcode,
	name: "Caramel Rice Crisps",
	nameProvenance: "source",
	brandOwner: "Quaker",
	servingLabel: "1 cake",
	servingWeightGrams: 13,
	hasSourceServing: true,
	nutrients: [
		{
			nutrientId: 1008,
			nutrientName: "Calories",
			nutrientNumber: "208",
			unitName: "kcal",
			value: 50,
		},
		{
			nutrientId: 1004,
			nutrientName: "Total Fat",
			nutrientNumber: "204",
			unitName: "g",
			value: 0.5,
		},
		{
			nutrientId: 1005,
			nutrientName: "Total Carbohydrates",
			nutrientNumber: "205",
			unitName: "g",
			value: 11,
		},
		{
			nutrientId: 1079,
			nutrientName: "Dietary Fiber",
			nutrientNumber: "291",
			unitName: "g",
			value: 0,
		},
		{
			nutrientId: 2000,
			nutrientName: "Total Sugars",
			nutrientNumber: "269",
			unitName: "g",
			value: 3,
		},
		{
			nutrientId: 1003,
			nutrientName: "Protein",
			nutrientNumber: "203",
			unitName: "g",
			value: 1,
		},
		{
			nutrientId: 1093,
			nutrientName: "Sodium",
			nutrientNumber: "307",
			unitName: "mg",
			value: 45,
		},
	],
	reportedNutrientIds: [1008, 1004, 1005, 1079, 2000, 1003, 1093],
	categories: ["Cereal Grains and Pasta"],
	resolvedCategory: "Cereal Grains and Pasta",
	categoryResolution: {
		categoryOptionId: "qa-grains",
		label: "Cereal Grains and Pasta",
		sourceValue: "Cereal Grains and Pasta",
		confidence: "exact",
	},
	source: "usda",
	sourceKey: "usda",
	sourceLabel: "USDA FDC",
	sourceReference: "12345",
};

const removeListMembershipTestFood = async (parallelWorkerIndex: number) => {
	const supabase =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);
	for (const listType of ["fridge", "shopping"] as const) {
		const { error } = await supabase.rpc("remove_user_food_list_item", {
			p_fdc_id: listMembershipTestFoodId,
			p_list_type: listType,
		});
		if (error) throw error;
	}
};

const seedListMembershipTestFood = async (parallelWorkerIndex: number) => {
	const supabase =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);
	await removeListMembershipTestFood(parallelWorkerIndex);
	const food = {
		fdcId: listMembershipTestFoodId,
		description: "Manual Entry Membership Product",
		foodCategory: "Other",
		barcode: listMembershipTestBarcode,
		barcodeSource: "manual",
		customFood: true,
		servingSize: 34,
		servingSizeUnit: "g",
		foodNutrients: [],
	};
	const { data, error } = await supabase.rpc("place_user_food_list_item", {
		p_allow_move: false,
		p_fdc_id: food.fdcId,
		p_food: food,
		p_list_type: "shopping",
	});
	if (error) throw error;
	if (data !== "added") {
		throw new Error(`Could not seed manual-entry list membership: ${data}`);
	}
};

const cleanUpOptionalPhotoProduct = async (parallelWorkerIndex: number) => {
	const supabase =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);
	const { data: customFoods, error: customFoodsError } = await supabase
		.from("custom_foods")
		.select("id, fdc_id")
		.eq("barcode", optionalPhotoProductBarcode);
	if (customFoodsError) throw customFoodsError;

	for (const customFood of customFoods ?? []) {
		for (const listType of ["fridge", "shopping"] as const) {
			const { error } = await supabase.rpc("remove_user_food_list_item", {
				p_fdc_id: customFood.fdc_id,
				p_list_type: listType,
			});
			if (error) throw error;
		}
	}

	if ((customFoods ?? []).length === 0) return;
	const { error: deleteError } = await supabase
		.from("custom_foods")
		.delete()
		.in(
			"id",
			(customFoods ?? []).map((customFood) => customFood.id),
		);
	if (deleteError) throw deleteError;
};
const cleanUpCanonicalCategoryDisplayTestFood = async (
	parallelWorkerIndex: number,
) => {
	const supabase =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);

	const { data: customFoods, error: customFoodsError } = await supabase
		.from("custom_foods")
		.select("id, fdc_id")
		.eq("name_key", canonicalCategoryDisplayTestNameKey);
	if (customFoodsError) throw customFoodsError;

	for (const customFood of customFoods ?? []) {
		for (const listType of ["fridge", "shopping"] as const) {
			const { error: listRemovalError } = await supabase.rpc(
				"remove_user_food_list_item",
				{ p_list_type: listType, p_fdc_id: customFood.fdc_id },
			);
			if (listRemovalError) throw listRemovalError;
		}
	}

	if ((customFoods ?? []).length > 0) {
		const { error: customFoodRemovalError } = await supabase
			.from("custom_foods")
			.delete()
			.in(
				"id",
				(customFoods ?? []).map((customFood) => customFood.id),
			);
		if (customFoodRemovalError) throw customFoodRemovalError;
	}
};

const readRenderedManualEntryNutrientGroups = async (dialog: Locator) =>
	dialog.locator(".manual-nutrients__group").evaluateAll((groupElements) =>
		groupElements.map((groupElement) => {
			const titleElement = groupElement.querySelector(
				".collapsible-section__title",
			);
			const title = Array.from(titleElement?.childNodes ?? [])
				.find((node) => node.nodeType === Node.TEXT_NODE)
				?.textContent?.trim();
			const fields = Array.from(
				groupElement.querySelectorAll<HTMLLabelElement>(
					".manual-nutrients__fields label",
				),
			).map((labelElement) => {
				const input = labelElement.querySelector("input");
				const label = labelElement
					.querySelector("span")
					?.textContent?.replace(/\s*\*\s*$/, "")
					.replace(/\s+/g, " ")
					.trim();
				return {
					label: label ?? "",
					required: input?.getAttribute("aria-required") === "true",
				};
			});

			return { title: title ?? "", fields };
		}),
	);

const expectRenderedManualEntryNutrientGroups = async (
	dialog: Locator,
	expectedGroups: ExpectedManualEntryNutrientGroup[],
) => {
	const renderedGroups = dialog.locator(".manual-nutrients__group");
	await expect(renderedGroups).toHaveCount(expectedGroups.length);

	for (let index = 0; index < expectedGroups.length; index += 1) {
		const renderedGroup = renderedGroups.nth(index);
		const isOpen = await renderedGroup.evaluate(
			(element) => (element as HTMLDetailsElement).open,
		);
		if (!isOpen) {
			await renderedGroup.locator("summary").click();
			await expect(renderedGroup).toHaveAttribute("open", "");
		}
	}

	await expect
		.poll(() => readRenderedManualEntryNutrientGroups(dialog))
		.toEqual(expectedGroups);
};

const expectManualEntryNutrientGroupOpenStates = async (
	dialog: Locator,
	expectedOpenStates: boolean[],
) => {
	const renderedGroups = dialog.locator(".manual-nutrients__group");
	await expect(renderedGroups).toHaveCount(expectedOpenStates.length);
	await expect
		.poll(() =>
			renderedGroups.evaluateAll((groupElements) =>
				groupElements.map(
					(groupElement) => (groupElement as HTMLDetailsElement).open,
				),
			),
		)
		.toEqual(expectedOpenStates);
};

const findNutrientGroupIndex = (
	groups: ExpectedManualEntryNutrientGroup[],
	titleFragment: string,
) => {
	const groupIndex = groups.findIndex((group) =>
		group.title.toLocaleLowerCase("en-US").includes(titleFragment),
	);
	expect(groupIndex).toBeGreaterThanOrEqual(0);
	return groupIndex;
};

const findSavedIngredientCard = async (
	page: Parameters<typeof waitForAppReady>[0],
	foodId: number,
) => {
	const card = page.locator(`li[data-food-id="${foodId}"]`);
	for (let attempt = 0; attempt < 10; attempt += 1) {
		if (await card.isVisible().catch(() => false)) return card;
		const loadMoreButton = page.getByRole("button", { name: "Load more" });
		if (!(await loadMoreButton.isVisible().catch(() => false))) break;
		await loadMoreButton.click();
		await expect
			.poll(
				async () =>
					(await card.isVisible().catch(() => false)) ||
					!(await loadMoreButton.isVisible().catch(() => false)) ||
					(await loadMoreButton.getAttribute("aria-busy")) !== "true",
			)
			.toBe(true);
	}
	await expect(card).toBeVisible();
	return card;
};

const expectNutritionCategory = async (
	page: Parameters<typeof waitForAppReady>[0],
	expectedCategory: string,
) => {
	const foodPassportSummary = page
		.locator("summary")
		.filter({ hasText: "Food passport" });
	await expect(foodPassportSummary).toBeVisible();
	await foodPassportSummary.click();
	const productDetailsSummary = page
		.locator("summary")
		.filter({ hasText: "Product details" });
	await expect(productDetailsSummary).toBeVisible();
	await productDetailsSummary.click();
	const categoryValue = page
		.locator("dt")
		.filter({ hasText: /^Category$/ })
		.locator("xpath=following-sibling::dd[1]");
	await expect(categoryValue).toContainText(expectedCategory);
	await expect(categoryValue).not.toContainText("Custom Ingredient");
};

test("manual entry defers required warnings until a forward attempt", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge/manual-entry");
	await waitForAppReady(page);

	const dialog = page.getByRole("dialog", { name: "Enter Manually" });
	await expect(dialog).toBeVisible();
	await expect(
		dialog.getByText("Name must be at least 3 characters"),
	).toHaveCount(0);

	await dialog.getByRole("button", { name: "Continue" }).click();
	await expect(
		dialog.getByText("Name must be at least 3 characters"),
	).toBeVisible();
});

test("manual-entry progress tabs perform the same forward validation", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge/manual-entry");
	await waitForAppReady(page);

	const dialog = page.getByRole("dialog", { name: "Enter Manually" });
	await dialog.getByRole("tab", { name: "Macros" }).click();

	await expect(dialog.getByRole("tab", { name: "Identity" })).toHaveAttribute(
		"aria-current",
		"step",
	);
	await expect(
		dialog.getByText("Name must be at least 3 characters"),
	).toBeVisible();
});

test("manual entry shows duplicate and move actions for the selected list", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"The disposable list-membership corpus runs once in Chromium.",
	);
	const baseUrl = new URL(
		String(testInfo.project.use.baseURL ?? "http://localhost:5174"),
	);
	test.skip(
		!["127.0.0.1", "localhost"].includes(baseUrl.hostname),
		"The list-membership corpus is restricted to disposable local infrastructure.",
	);
	await page.route(
		`**/api/products/barcode/${listMembershipTestBarcode}`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					status: "not-found",
					barcode: listMembershipTestBarcode,
				}),
			});
		},
	);
	await seedListMembershipTestFood(testInfo.parallelIndex);

	try {
		await page.goto("/ingredients/fridge/manual-entry");
		await waitForAppReady(page);
		const dialog = page.getByRole("dialog", { name: "Enter Manually" });
		await dialog
			.getByLabel("Food name")
			.fill("Manual Entry Membership Product");
		await dialog.getByLabel("UPC / Barcode").fill("4006381333931");
		await dialog.getByLabel("UPC / Barcode").press("Tab");
		await expect(dialog.getByText(/No source match found/i)).toBeVisible();
		await dialog.getByRole("button", { name: "Category" }).click();
		await dialog.getByRole("button", { name: "Jams", exact: true }).click();
		await dialog.getByRole("button", { name: "Continue" }).click();
		await dialog.getByLabel("Weight (g)").fill("34");
		await dialog.getByRole("button", { name: "Continue" }).click();

		for (const nutrient of [
			{ label: /^Calories \(kcal\)/, value: "160" },
			{ label: /^Total Fat \(g\)/, value: "6" },
			{ label: /^Total Carbohydrates \(g\)/, value: "20" },
			{ label: /^Protein \(g\)/, value: "2" },
			{ label: /^Sodium.*\(mg\)/, value: "120" },
		]) {
			await dialog.getByLabel(nutrient.label).fill(nutrient.value);
		}
		await dialog.getByRole("button", { name: "Continue" }).click();
		await dialog.getByRole("button", { name: "Continue" }).click();

		await expect(
			dialog.getByRole("button", { name: "Move to Fridge" }),
		).toBeEnabled();
		await expect(
			dialog.getByText(/already saved in Shopping List/i),
		).toBeVisible();
		await dialog.getByRole("combobox", { name: "Add after saving" }).click();
		await dialog
			.getByRole("option", { name: "Shopping List", exact: true })
			.click();
		await expect(
			dialog.getByRole("button", { name: "Already saved" }),
		).toBeDisabled();
		await expect(
			dialog.getByText(/already saved in Shopping List/i),
		).toBeVisible();
		await dialog.getByRole("combobox", { name: "Add after saving" }).click();
		await dialog.getByRole("option", { name: "Fridge", exact: true }).click();
		await dialog.getByRole("button", { name: "Move to Fridge" }).click();
		const moveDialog = page.getByRole("alertdialog", {
			name: "Move ingredient?",
		});
		await expect(moveDialog).toContainText(/already in Shopping List/i);
		await moveDialog.getByRole("button", { name: "Move", exact: true }).click();
		await expect(dialog).not.toBeVisible();

		const supabase = await getAuthenticatedLocalQaDatabaseClient(
			testInfo.parallelIndex,
		);
		await expect
			.poll(async () => {
				const { data, error } = await supabase
					.from("user_food_list_items")
					.select("fdc_id, food, list_type")
					.eq("fdc_id", listMembershipTestFoodId);
				if (error) throw error;
				return data.map((row) => ({
					fdcId: row.fdc_id,
					listType: row.list_type,
					description: (row.food as { description?: unknown }).description,
				}));
			})
			.toEqual([
				{
					fdcId: listMembershipTestFoodId,
					listType: "fridge",
					description: "Manual Entry Membership Product",
				},
			]);
		const { count: customFoodCount, error: customFoodError } = await supabase
			.from("custom_foods")
			.select("id", { count: "exact", head: true })
			.eq("barcode", listMembershipTestBarcode);
		if (customFoodError) throw customFoodError;
		expect(customFoodCount).toBe(0);
	} finally {
		await removeListMembershipTestFood(testInfo.parallelIndex);
	}
});

test("manual entry shows one message when its reference catalog response is unavailable", async ({
	page,
}) => {
	const directReferenceTableRequests: string[] = [];
	page.on("request", (request) => {
		if (
			/nutrient_(?:relationship_rules|source_mappings)/u.test(request.url())
		) {
			directReferenceTableRequests.push(request.url());
		}
	});
	await page.route("**/api/manual-entry/reference-data", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({}),
		});
	});

	await page.goto("/ingredients/fridge/manual-entry");
	await waitForAppReady(page);

	const dialog = page.getByRole("dialog", { name: "Enter Manually" });
	await dialog.getByLabel("Food name").fill("Reference data regression food");
	await dialog.getByRole("button", { name: "Category" }).click();
	const categorySearch = dialog.getByRole("searchbox", {
		name: "Search categories",
	});
	await categorySearch.fill("protein bar");
	await expect(
		dialog.getByRole("status", { name: "Searching categories" }),
	).toBeHidden({ timeout: 20_000 });
	await dialog
		.getByRole("button", { name: "Protein Bars", exact: true })
		.first()
		.click();
	await dialog.getByRole("button", { name: "Continue" }).click();
	await dialog.getByLabel("Weight (g)").fill("100");
	await dialog.getByRole("button", { name: "Continue" }).click();

	await expect(
		dialog.getByText(expectedManualEntryReferenceDataUnavailableMessage),
	).toHaveCount(1);
	await expect(
		dialog.getByText("Nutrition label scanning is unavailable.", {
			exact: false,
		}),
	).toHaveCount(0);
	await expect(
		dialog.getByText("Nutrition validation rules could not be loaded.", {
			exact: false,
		}),
	).toHaveCount(0);
	expect(directReferenceTableRequests).toEqual([]);
});

test("manual barcode entry shows input-bound progress until lookup finishes", async ({
	page,
}) => {
	let markLookupStarted = () => {};
	const lookupStarted = new Promise<void>((resolve) => {
		markLookupStarted = resolve;
	});
	let releaseLookup = () => {};
	const lookupMayFinish = new Promise<void>((resolve) => {
		releaseLookup = resolve;
	});
	await page.route("**/api/products/barcode/04006381333931", async (route) => {
		markLookupStarted();
		await lookupMayFinish;
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				status: "not-found",
				barcode: "04006381333931",
			}),
		});
	});

	await page.goto("/ingredients/fridge/manual-entry");
	await waitForAppReady(page);

	const dialog = page.getByRole("dialog", { name: "Enter Manually" });
	const barcodeInput = dialog.getByLabel("UPC / Barcode");
	const loadingFrame = barcodeInput.locator("xpath=parent::span");
	const continueButton = dialog.getByRole("button", { name: "Continue" });
	await barcodeInput.fill("4006381333931");

	await expect(loadingFrame).toHaveAttribute("aria-busy", "true");
	await expect(
		loadingFrame.getByRole("status", { name: "Checking barcode sources" }),
	).toBeVisible();
	await expect(continueButton).toBeDisabled();

	await lookupStarted;
	releaseLookup();
	await expect(loadingFrame).toHaveAttribute("aria-busy", "false");
	await expect(
		loadingFrame.getByRole("status", { name: "Checking barcode sources" }),
	).toHaveCount(0);
	await expect(continueButton).toBeEnabled();
});

test("an optional source product photo enters moderation without blocking a private save", async ({
	page,
}, testInfo) => {
	testInfo.setTimeout(120_000);
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One isolated local Chromium project owns the optional-photo save corpus.",
	);
	const baseUrl = new URL(
		String(testInfo.project.use.baseURL ?? "http://localhost:5174"),
	);
	test.skip(
		!["127.0.0.1", "localhost"].includes(baseUrl.hostname),
		"The optional-photo save corpus is restricted to disposable local infrastructure.",
	);
	const supabase = await getAuthenticatedLocalQaDatabaseClient(
		testInfo.parallelIndex,
	);

	let intakeRequestBody: Buffer | null = null;
	let intakeRequestCount = 0;
	await page.route(
		`**/api/products/barcode/${optionalPhotoProductBarcode}`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					status: "found",
					draft: optionalPhotoProductDraft,
				}),
			});
		},
	);
	await page.route(
		`**/api/products/barcode/${optionalPhotoProductBarcode}/share-validation`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					status: "matched",
					barcode: optionalPhotoProductBarcode,
					draft: optionalPhotoProductDraft,
					defaultSharingAllowed: true,
					requiresCatalogEvidence: false,
				}),
			});
		},
	);
	await page.route("**/api/intake/v1/product-observations", async (route) => {
		intakeRequestCount += 1;
		intakeRequestBody = route.request().postDataBuffer();
		await route.fulfill({
			status: 201,
			contentType: "application/json",
			body: JSON.stringify({
				status: "pending",
				message:
					"The ingredient was saved privately. The product image is waiting for moderator review before it can be shared.",
				evidenceAccepted: true,
			}),
		});
	});

	const openProductAtShare = async () => {
		await page.goto("/ingredients/fridge/manual-entry");
		await waitForAppReady(page);
		const dialog = page.getByRole("dialog", { name: "Enter Manually" });
		const barcodeInput = dialog.getByLabel("UPC / Barcode");
		await barcodeInput.fill(optionalPhotoProductBarcode);
		await barcodeInput.press("Tab");
		await expect(
			dialog.getByText("Caramel Rice Crisps · Quaker", { exact: true }),
		).toBeVisible();
		await dialog.getByRole("button", { name: "Autofill" }).click();
		const shareTab = dialog.getByRole("tab", { name: "Share" });
		await shareTab.click();
		await expect(shareTab).toHaveAttribute("aria-selected", "true");
		await expect(dialog.getByLabel("Share with community")).toBeChecked();
		return dialog;
	};

	await cleanUpOptionalPhotoProduct(testInfo.parallelIndex);
	try {
		let dialog = await openProductAtShare();
		const frontPhotoInput = dialog.getByLabel("Front of package");
		await expect(frontPhotoInput).toBeVisible();
		await expect(frontPhotoInput).not.toHaveAttribute("required", "");
		await expect(dialog.getByLabel("Nutrition facts label")).toHaveCount(0);
		await expect(dialog.getByLabel("Barcode", { exact: true })).toHaveCount(0);

		await dialog.getByLabel("Share with community").click();
		await dialog.getByRole("button", { name: "Add Ingredient" }).click();
		await expect(dialog).toBeHidden();
		expect(intakeRequestCount).toBe(0);

		const { count: privateFoodCount, error: privateFoodError } = await supabase
			.from("custom_foods")
			.select("id", { count: "exact", head: true })
			.eq("barcode", optionalPhotoProductBarcode);
		if (privateFoodError) throw privateFoodError;
		expect(privateFoodCount).toBe(1);

		await cleanUpOptionalPhotoProduct(testInfo.parallelIndex);
		await page.evaluate(() => sessionStorage.clear());
		dialog = await openProductAtShare();
		await dialog.getByLabel("Front of package").setInputFiles({
			name: "caramel-rice-crisps-front.png",
			mimeType: "image/png",
			buffer: Buffer.from("browser evidence upload"),
		});
		await expect(dialog.getByLabel("Share with community")).not.toBeChecked();
		await dialog.getByLabel("Share with community").click();
		await expect(dialog.getByLabel("Share with community")).toBeChecked();
		const addButton = dialog.getByRole("button", { name: "Add Ingredient" });
		await expect(addButton).toBeEnabled({ timeout: 30_000 });
		await addButton.click();
		await expect.poll(() => intakeRequestCount).toBe(1);

		expect(intakeRequestBody).not.toBeNull();
		const multipartBody = intakeRequestBody!.toString("latin1");
		expect(multipartBody).toContain(
			'name="frontPhoto"; filename="caramel-rice-crisps-front.png"',
		);
		expect(multipartBody).not.toContain('name="nutritionPhoto"');
		expect(multipartBody).not.toContain('name="barcodePhoto"');
		expect(multipartBody).not.toContain('name="reviewFlags"');

		const publicProductResponse = await page.request.get(
			`/api/v1/products/${optionalPhotoProductBarcode}`,
		);
		expect(publicProductResponse.status()).toBe(404);
	} finally {
		await cleanUpOptionalPhotoProduct(testInfo.parallelIndex);
	}
});

test("regulated alcohol lookup keeps sparse nutrition honest before Share", async ({
	page,
}) => {
	await page.route(
		/\/api\/products\/barcode\/(?:850027056715|00850027056715)$/,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					status: "found",
					draft: {
						barcode: "00850027056715",
						name: "Straightaway Espresso Martini",
						nameProvenance: "source",
						brandOwner: "Straightaway",
						servingLabel: "100 g",
						servingWeightGrams: 100,
						hasSourceServing: false,
						nutrients: [],
						reportedNutrientIds: [],
						categories: ["Cocktails"],
						resolvedCategory: "Other",
						categoryResolution: {
							categoryOptionId: "other",
							label: "Other",
							sourceValue: "Cocktails",
							confidence: "reviewed",
						},
						packageQuantity: {
							label: "100 mL",
							amount: 100,
							unit: "mL",
						},
						alcoholByVolume: {
							percent: 20,
							valueStatus: "reported",
							basis: "volume-percent",
							sourceUnit: "% ABV",
						},
						regulatoryDisclosure: {
							profileKey: "us-ttb-alcohol-beverage-v1",
							evidenceStatus: "source-reported",
						},
						source: "cola-cloud",
						sourceLabel: "COLA Cloud",
						sourceReference: "24134001000441",
					},
				}),
			});
		},
	);

	await page.goto("/ingredients/fridge/manual-entry");
	await waitForAppReady(page);

	const dialog = page.getByRole("dialog", { name: "Enter Manually" });
	const barcodeInput = dialog.getByLabel("UPC / Barcode");
	await barcodeInput.fill("850027056715");
	await barcodeInput.press("Tab");
	await expect(
		dialog.getByText("Straightaway Espresso Martini · Straightaway"),
	).toBeVisible();
	await dialog.getByRole("button", { name: "Autofill" }).click();
	await expect(
		dialog.getByText("Straightaway Espresso Martini", { exact: true }),
	).toBeVisible();
	await dialog.getByRole("tab", { name: "Servings" }).click();

	await expect(dialog.getByLabel("Label format optional")).toHaveText(
		"Alcohol beverage label",
	);
	await expect(dialog.getByLabel("Alcohol by volume (%) *")).toHaveValue("20");
	await expect(dialog.getByLabel("Weight (g) optional")).toHaveValue("");
	await expect(
		dialog.getByText("No package serving was reported"),
	).toBeVisible();

	await dialog.getByRole("button", { name: "Continue" }).click();
	await expect(
		dialog.getByText(/legally omit standard nutrition/i),
	).toBeVisible();
	await expect(dialog.getByLabel("Calories (kcal)")).not.toHaveAttribute(
		"aria-required",
		"true",
	);
	await dialog.getByRole("button", { name: "Continue" }).click();
	await dialog.getByRole("button", { name: "Continue" }).click();
	await expect(
		dialog.getByText(
			"No nutrition values were reported; missing values remain unknown",
		),
	).toBeVisible();
	await expect(
		dialog.getByText("Alcohol beverage label · 20% ABV · 100 mL"),
	).toBeVisible();
});

test("the DB-backed category picker searches, selects, and restores focus", async ({
	page,
}) => {
	await page.goto("/ingredients/fridge/manual-entry");
	await waitForAppReady(page);

	const dialog = page.getByRole("dialog", { name: "Enter Manually" });
	await dialog.getByLabel("Food name").fill("Playwright lentil bowl");
	const categoryTrigger = dialog.getByRole("button", { name: "Category" });
	await expect(categoryTrigger).toBeEnabled();
	await categoryTrigger.click();

	const categorySearch = dialog.getByRole("searchbox", {
		name: "Search categories",
	});
	await expect(categorySearch).toBeFocused();
	await categorySearch.fill("legume");
	await expect(
		dialog.getByRole("status", { name: "Searching categories" }),
	).toBeHidden({ timeout: 20_000 });
	const categoryResult = dialog
		.getByRole("button", { name: /Legumes and Legume Products/i })
		.first();
	await expect(categoryResult).toBeVisible();
	await categoryResult.click();
	await expect(categoryTrigger).toContainText(/Legumes and Legume Products/i);
	await expect(categoryTrigger).toBeFocused();

	await categoryTrigger.click();
	await page.keyboard.press("Escape");
	await expect(categoryTrigger).toHaveAttribute("aria-expanded", "false");
	await expect(categoryTrigger).toBeFocused();
});

test("the category picker remains keyboard-operable and unclipped at 200% zoom", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"The deterministic 200%-zoom reflow check runs once in Chromium.",
	);
	let releaseInitialCategoryRequest = () => {};
	const initialCategoryRequestMayContinue = new Promise<void>((resolve) => {
		releaseInitialCategoryRequest = resolve;
	});
	let heldInitialCategoryRequest = false;
	await page.route("**/api/food-categories?**", async (route) => {
		if (!heldInitialCategoryRequest) {
			heldInitialCategoryRequest = true;
			await initialCategoryRequestMayContinue;
		}
		await route.continue();
	});
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/ingredients/fridge/manual-entry");
	await waitForAppReady(page);
	await page.evaluate(() => {
		document.documentElement.style.zoom = "2";
	});

	const dialog = page.getByRole("dialog", { name: "Enter Manually" });
	await dialog.getByLabel("Food name").fill("Chocolate Dough Protein Bar");
	const brandInput = dialog.getByLabel("Brand");
	const categoryTrigger = dialog.getByRole("button", { name: "Category" });
	await expect(categoryTrigger).toHaveCount(1);
	await expect(categoryTrigger).toHaveAttribute("aria-busy", "true");
	await expect(categoryTrigger.locator(".loading-spinner")).toHaveCount(1);
	releaseInitialCategoryRequest();
	await expect(categoryTrigger).toBeEnabled();
	await expect(categoryTrigger).toHaveAttribute("aria-expanded", "false");
	await brandInput.focus();
	await page.keyboard.press("Tab");
	await expect(categoryTrigger).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(categoryTrigger).toHaveAttribute("aria-expanded", "true");

	const categorySearch = dialog.getByRole("searchbox", {
		name: "Search categories",
	});
	await expect(categorySearch).toBeFocused();
	await categorySearch.fill("protein bar");
	await expect(
		dialog.getByRole("status", { name: "Searching categories" }),
	).toBeHidden({ timeout: 20_000 });
	const categoryResult = dialog
		.getByRole("button", { name: "Protein Bars", exact: true })
		.first();
	await expect(categoryResult).toBeVisible();
	await page.keyboard.press("Tab");
	await expect(categoryResult).toBeFocused();
	const categoryResultBounds = await categoryResult.boundingBox();
	expect(categoryResultBounds).not.toBeNull();
	expect(categoryResultBounds!.height).toBeGreaterThanOrEqual(88);
	await page.keyboard.press("Enter");
	await expect(categoryTrigger).toContainText("Protein Bars");
	await expect(categoryTrigger).toBeFocused();

	await page.keyboard.press("Enter");
	await page.keyboard.press("Escape");
	await expect(categoryTrigger).toHaveAttribute("aria-expanded", "false");
	await expect(categoryTrigger).toBeFocused();

	await page.keyboard.press("Enter");
	await expect(categorySearch).toBeFocused();
	const pickerPanel = dialog.locator(".food-category-picker__panel");
	const pickerControls = [categoryTrigger, categorySearch];
	for (const control of pickerControls) {
		const bounds = await control.boundingBox();
		expect(bounds).not.toBeNull();
		expect(bounds!.height).toBeGreaterThanOrEqual(88);
	}
	const pickerLayout = await pickerPanel.evaluate((panel) => {
		const panelBounds = panel.getBoundingClientRect();
		const controls = Array.from(
			panel.querySelectorAll<HTMLElement>("input, button"),
		).map((control) => {
			const bounds = control.getBoundingClientRect();
			return {
				left: bounds.left,
				right: bounds.right,
			};
		});
		const textBlocks = Array.from(
			panel.querySelectorAll<HTMLElement>("h3, small, p, button"),
		)
			.filter(
				(element) =>
					!element.classList.contains("sr-only") &&
					element.getClientRects().length > 0 &&
					element.clientWidth > 1,
			)
			.map((element) => ({
				clientWidth: element.clientWidth,
				scrollWidth: element.scrollWidth,
			}));
		return {
			controls,
			documentClientWidth: document.documentElement.clientWidth,
			documentScrollWidth: document.documentElement.scrollWidth,
			panelLeft: panelBounds.left,
			panelRight: panelBounds.right,
			textBlocks,
		};
	});
	expect(pickerLayout.documentScrollWidth).toBeLessThanOrEqual(
		pickerLayout.documentClientWidth,
	);
	for (const control of pickerLayout.controls) {
		expect(control.left).toBeGreaterThanOrEqual(pickerLayout.panelLeft - 1);
		expect(control.right).toBeLessThanOrEqual(pickerLayout.panelRight + 1);
	}
	for (const textBlock of pickerLayout.textBlocks) {
		expect(textBlock.scrollWidth).toBeLessThanOrEqual(
			textBlock.clientWidth + 1,
		);
	}
});

test("manual entry renders every approved DB nutrient group and field", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"The complete DB-to-browser nutrient catalog comparison runs once in Chromium.",
	);
	const baseUrl = new URL(
		String(testInfo.project.use.baseURL ?? "http://localhost:5174"),
	);
	test.skip(
		!["127.0.0.1", "localhost"].includes(baseUrl.hostname),
		"The authoritative catalog comparison is restricted to disposable local infrastructure.",
	);

	const supabase = await getAuthenticatedLocalQaDatabaseClient(
		testInfo.parallelIndex,
	);
	const nutrientCatalog =
		await readApprovedManualEntryNutrientCatalog(supabase);

	expect(nutrientCatalog.macros).toHaveLength(3);
	expect(nutrientCatalog.extended).toHaveLength(7);
	expect(nutrientCatalog.macros.flatMap((group) => group.fields)).toHaveLength(
		13,
	);
	expect(
		nutrientCatalog.extended.flatMap((group) => group.fields),
	).toHaveLength(55);

	await page.goto("/ingredients/fridge/manual-entry");
	await waitForAppReady(page);
	const dialog = page.getByRole("dialog", { name: "Enter Manually" });
	await dialog.getByLabel("Food name").fill("DB Nutrient Group Test");
	await dialog.getByRole("button", { name: "Category" }).click();
	const categorySearch = dialog.getByRole("searchbox", {
		name: "Search categories",
	});
	await categorySearch.fill("protein bar");
	await expect(
		dialog.getByRole("status", { name: "Searching categories" }),
	).toBeHidden({ timeout: 20_000 });
	await dialog
		.getByRole("button", { name: "Protein Bars", exact: true })
		.first()
		.click();
	await dialog.getByRole("button", { name: "Continue" }).click();
	await dialog.getByLabel("Weight (g)").fill("100");
	await expect(
		dialog.getByRole("switch", { name: "Package measure" }),
	).not.toBeChecked();
	await dialog.getByRole("button", { name: "Continue" }).click();
	const privateMacroGroups = nutrientCatalog.macros.map((group) => ({
		...group,
		fields: group.fields.map((field) => ({ ...field, required: false })),
	}));

	await expectManualEntryNutrientGroupOpenStates(
		dialog,
		privateMacroGroups.map((_, index) => index === 0),
	);
	await expectRenderedManualEntryNutrientGroups(dialog, privateMacroGroups);
	await expect(
		dialog.locator(".manual-nutrients__group", { hasText: "Mineral details" }),
	).toHaveCount(0);
	await expect(dialog.getByLabel(/^Total Sugars \(g\)/)).toHaveCount(1);

	await dialog.getByRole("button", { name: "Continue" }).click();
	await expect(dialog.getByRole("tab", { name: "Extended" })).toHaveAttribute(
		"aria-current",
		"step",
	);

	const extendedGroups = dialog.locator(".manual-nutrients__group");
	const allExtendedGroupsClosed = nutrientCatalog.extended.map(() => false);
	await expectManualEntryNutrientGroupOpenStates(
		dialog,
		allExtendedGroupsClosed,
	);
	for (let index = 0; index < nutrientCatalog.extended.length; index += 1) {
		await expect(
			extendedGroups.nth(index).locator("summary .text-badge"),
		).toHaveCount(1);
		await expect(
			extendedGroups.nth(index).locator("summary .text-badge"),
		).toHaveText("optional");
	}
	await expect(
		dialog.locator(".manual-nutrients__fields .text-badge"),
	).toHaveCount(0);

	const vitaminsIndex = findNutrientGroupIndex(
		nutrientCatalog.extended,
		"vitamin",
	);
	const mineralsIndex = findNutrientGroupIndex(
		nutrientCatalog.extended,
		"mineral",
	);
	const aminoAcidsIndex = findNutrientGroupIndex(
		nutrientCatalog.extended,
		"amino",
	);
	const expectedOpenStates = [...allExtendedGroupsClosed];

	await extendedGroups.nth(vitaminsIndex).locator("summary").click();
	expectedOpenStates[vitaminsIndex] = true;
	await expectManualEntryNutrientGroupOpenStates(dialog, expectedOpenStates);
	const vitaminInput = extendedGroups
		.nth(vitaminsIndex)
		.locator(".manual-nutrients__fields input")
		.first();
	await vitaminInput.fill("1.25");

	await extendedGroups.nth(mineralsIndex).locator("summary").click();
	expectedOpenStates[mineralsIndex] = true;
	await expectManualEntryNutrientGroupOpenStates(dialog, expectedOpenStates);

	await extendedGroups.nth(aminoAcidsIndex).locator("summary").click();
	expectedOpenStates[aminoAcidsIndex] = true;
	await expectManualEntryNutrientGroupOpenStates(dialog, expectedOpenStates);

	await extendedGroups.nth(mineralsIndex).locator("summary").click();
	expectedOpenStates[mineralsIndex] = false;
	await expectManualEntryNutrientGroupOpenStates(dialog, expectedOpenStates);

	await extendedGroups.nth(vitaminsIndex).locator("summary").click();
	expectedOpenStates[vitaminsIndex] = false;
	await expectManualEntryNutrientGroupOpenStates(dialog, expectedOpenStates);
	await extendedGroups.nth(vitaminsIndex).locator("summary").click();
	expectedOpenStates[vitaminsIndex] = true;
	await expectManualEntryNutrientGroupOpenStates(dialog, expectedOpenStates);
	await expect(vitaminInput).toHaveValue("1.25");

	await dialog.getByRole("button", { name: "Back", exact: true }).click();
	await expect(dialog.getByRole("tab", { name: "Macros" })).toHaveAttribute(
		"aria-current",
		"step",
	);
	await dialog.getByRole("button", { name: "Continue" }).click();
	await expect(dialog.getByRole("tab", { name: "Extended" })).toHaveAttribute(
		"aria-current",
		"step",
	);
	await expectManualEntryNutrientGroupOpenStates(
		dialog,
		allExtendedGroupsClosed,
	);
	await extendedGroups.nth(vitaminsIndex).locator("summary").click();
	await expect(
		extendedGroups
			.nth(vitaminsIndex)
			.locator(".manual-nutrients__fields input")
			.first(),
	).toHaveValue("1.25");

	await expectRenderedManualEntryNutrientGroups(
		dialog,
		nutrientCatalog.extended,
	);
	await expect(dialog.getByLabel(/^Total Sugars \(g\)/)).toHaveCount(0);
});

test("canonical categories persist across saved cards and nutrition details", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"The disposable write-and-cleanup corpus runs once in Chromium.",
	);
	const baseUrl = new URL(
		String(testInfo.project.use.baseURL ?? "http://localhost:5174"),
	);
	test.skip(
		!["127.0.0.1", "localhost"].includes(baseUrl.hostname),
		"The write-and-cleanup corpus is restricted to disposable local infrastructure.",
	);
	test.slow();
	await cleanUpCanonicalCategoryDisplayTestFood(testInfo.parallelIndex);

	try {
		await page.goto("/ingredients/fridge");
		await waitForAppReady(page);
		const existingFoods = [
			{
				fdcId: 9_100_001,
				name: "Strawberry Jelly, Strawberry",
				category: "Jams",
			},
			{
				fdcId: 9_100_003,
				name: "Gochu Jang Hot & Sweet Chili Sauce",
				category: "Dips and Salsa",
			},
		];

		for (const existingFood of existingFoods) {
			const card = await findSavedIngredientCard(page, existingFood.fdcId);
			await expect(card.locator("small")).toHaveText(existingFood.category);
			await card
				.getByRole("button", { name: `Preview ${existingFood.name}` })
				.click();
			await expect(page).toHaveURL(
				new RegExp(
					`/ingredients/fridge/nutrition/${existingFood.fdcId}(?:\\?actions=hide)?$`,
				),
			);
			await expectNutritionCategory(page, existingFood.category);
			await page.getByRole("button", { name: "Back to ingredients" }).click();
			await expect(page).toHaveURL(/\/ingredients\/fridge$/);
		}

		await page.goto("/ingredients/fridge/manual-entry");
		await waitForAppReady(page);
		const dialog = page.getByRole("dialog", { name: "Enter Manually" });
		await dialog.getByLabel("Food name").fill(canonicalCategoryDisplayTestName);
		await dialog.getByRole("button", { name: "Category" }).click();
		const categorySearch = dialog.getByRole("searchbox", {
			name: "Search categories",
		});
		await categorySearch.fill("protein bar");
		await expect(
			dialog.getByRole("status", { name: "Searching categories" }),
		).toBeHidden({ timeout: 20_000 });
		await dialog
			.getByRole("button", { name: "Protein Bars", exact: true })
			.first()
			.click();
		await dialog.getByRole("button", { name: "Continue" }).click();
		await dialog.getByLabel("Weight (g)").fill("50");
		await dialog.getByRole("button", { name: "Continue" }).click();

		const requiredNutrients = [
			{ label: /^Calories \(kcal\)/, value: "200" },
			{ label: /^Total Fat \(g\)/, value: "5" },
			{ label: /^Total Carbohydrates \(g\)/, value: "20" },
			{ label: /^Protein \(g\)/, value: "10" },
			{ label: /^Sodium.*\(mg\)/, value: "100" },
		];
		for (const nutrient of requiredNutrients) {
			await dialog.getByLabel(nutrient.label).fill(nutrient.value);
		}
		await dialog.getByRole("button", { name: "Continue" }).click();
		await dialog.getByRole("button", { name: "Continue" }).click();
		await dialog.getByRole("button", { name: "Add Ingredient" }).click();
		await expect(page).toHaveURL(
			/\/ingredients\/fridge\/nutrition\/-\d+(?:\?actions=hide)?$/,
		);
		await expect(
			page.getByRole("heading", {
				name: canonicalCategoryDisplayTestName,
				exact: true,
			}),
		).toBeVisible();
		await expect(dialog).toBeHidden();

		await page.reload();
		await waitForAppReady(page);
		await expectNutritionCategory(page, "Protein Bars");
		await page.getByRole("button", { name: "Back to ingredients" }).click();
		await expect(page).toHaveURL(/\/ingredients\/fridge$/);
		const savedCard = page
			.locator("li[data-food-id]")
			.filter({ hasText: canonicalCategoryDisplayTestName })
			.first();
		await expect(savedCard).toBeVisible();
		await expect(savedCard.locator("small")).toHaveText("Protein Bars");
		await expect(savedCard).not.toContainText("Custom Ingredient");
	} finally {
		await cleanUpCanonicalCategoryDisplayTestFood(testInfo.parallelIndex);
	}
});
