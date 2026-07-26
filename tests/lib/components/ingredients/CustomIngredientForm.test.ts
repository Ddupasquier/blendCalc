import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

const customFoodMocks = vi.hoisted(() => ({
	saveCustomFood: vi.fn().mockResolvedValue("saved"),
	findCustomFoodByBarcode: vi.fn().mockReturnValue(null),
	findCustomFoodByName: vi.fn().mockReturnValue(null),
}));

vi.mock("$lib/utils/food/custom/customFoods", async (importOriginal) => {
	const actual = await importOriginal<typeof import("$lib/utils/food/custom/customFoods")>();
	return {
		...actual,
		saveCustomFood: customFoodMocks.saveCustomFood,
		findCustomFoodByBarcode: customFoodMocks.findCustomFoodByBarcode,
		findCustomFoodByName: customFoodMocks.findCustomFoodByName,
	};
});

const smoothieListMocks = vi.hoisted(() => ({
	addFoodToSmoothieList: vi.fn().mockResolvedValue("added"),
	moveFoodToSmoothieList: vi.fn().mockResolvedValue("moved"),
	removeFoodFromSmoothieList: vi.fn().mockResolvedValue("removed"),
}));

vi.mock("$lib/utils/storage/client/smoothieLists", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("$lib/utils/storage/client/smoothieLists")>();
	return {
		...actual,
		addFoodToSmoothieList: smoothieListMocks.addFoodToSmoothieList,
		moveFoodToSmoothieList: smoothieListMocks.moveFoodToSmoothieList,
		removeFoodFromSmoothieList: smoothieListMocks.removeFoodFromSmoothieList,
	};
});

const { submitSharedProduct, validateBarcodeProductForSharing } = vi.hoisted(() => ({
	submitSharedProduct: vi.fn().mockResolvedValue({
		status: "pending",
		message: "Waiting for review.",
	}),
	validateBarcodeProductForSharing: vi.fn().mockResolvedValue({
		status: "not-found",
		barcode: "04006381333931",
	}),
}));

vi.mock("$lib/utils/products/catalog", () => ({
	submitSharedProduct,
	validateBarcodeProductForSharing,
}));

const barcodeLookupMocks = vi.hoisted(() => ({
	lookupBarcodeProduct: vi.fn().mockResolvedValue({
		status: "not-found",
		barcode: "04006381333931",
	}),
}));

vi.mock("$lib/utils/barcode/productLookup", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("$lib/utils/barcode/productLookup")>();
	return {
		...actual,
		lookupBarcodeProduct: barcodeLookupMocks.lookupBarcodeProduct,
	};
});

const nutrientRelationshipMocks = vi.hoisted(() => ({
	readNutrientRelationshipRules: vi.fn().mockResolvedValue([
		{
			id: "total-sugars-lte-carbs",
			parentNutrientId: 1005,
			childNutrientId: 2000,
			relationship: "child_must_not_exceed_parent",
			severity: "error",
			message: "Total sugars cannot exceed total carbohydrates.",
			requiresParent: true,
			tolerance: 0,
		},
		{
			id: "added-sugars-lte-total-sugars",
			parentNutrientId: 2000,
			childNutrientId: 1235,
			relationship: "child_must_not_exceed_parent",
			severity: "error",
			message: "Added sugars cannot exceed total sugars.",
			requiresParent: true,
			tolerance: 0,
		},
	]),
}));

vi.mock("$lib/utils/food/nutrients/nutrientRelationshipRules", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("$lib/utils/food/nutrients/nutrientRelationshipRules")>();
	return {
		...actual,
		readNutrientRelationshipRules:
			nutrientRelationshipMocks.readNutrientRelationshipRules,
	};
});

const foodMetadataMocks = vi.hoisted(() => {
	const macros = [
		{
			dedupeKey: "macros:required-basics:calories-kcal",
			nutrientId: 1008,
			nutrientName: "Calories",
			nutrientNumber: "208",
			unitName: "kcal",
			nutrientType: "macro",
			step: "macros" as const,
			group: "Macros",
			groupSort: 10,
			sort: 10,
			label: "Calories (kcal)",
			requiredForManualEntry: true,
		},
		{
			dedupeKey: "macros:required-basics:total-fat-g",
			nutrientId: 1004,
			nutrientName: "Total Fat",
			nutrientNumber: "204",
			unitName: "g",
			nutrientType: "macro",
			step: "macros" as const,
			group: "Macros",
			groupSort: 10,
			sort: 20,
			label: "Total Fat (g)",
			requiredForManualEntry: true,
		},
		{
			dedupeKey: "macros:required-basics:total-carbohydrates-g",
			nutrientId: 1005,
			nutrientName: "Total Carbohydrates",
			nutrientNumber: "205",
			unitName: "g",
			nutrientType: "macro",
			step: "macros" as const,
			group: "Macros",
			groupSort: 10,
			sort: 30,
			label: "Total Carbohydrates (g)",
			requiredForManualEntry: true,
		},
		{
			dedupeKey: "macros:carbohydrate-details:dietary-fiber-g",
			nutrientId: 1079,
			nutrientName: "Dietary Fiber",
			nutrientNumber: "291",
			unitName: "g",
			nutrientType: "macro",
			step: "macros" as const,
			group: "Macros",
			groupSort: 10,
			sort: 40,
			label: "Dietary Fiber (g)",
			requiredForManualEntry: false,
		},
		{
			dedupeKey: "macros:carbohydrate-details:total-sugars-g",
			nutrientId: 2000,
			nutrientName: "Total Sugars",
			nutrientNumber: "269",
			unitName: "g",
			nutrientType: "macro",
			step: "macros" as const,
			group: "Macros",
			groupSort: 10,
			sort: 50,
			label: "Total Sugars (g)",
			requiredForManualEntry: false,
		},
		{
			dedupeKey: "macros:carbohydrate-details:added-sugars-g",
			nutrientId: 1235,
			nutrientName: "Sugars, added",
			nutrientNumber: "539",
			unitName: "g",
			nutrientType: "macro",
			step: "macros" as const,
			group: "Macros",
			groupSort: 10,
			sort: 55,
			label: "Sugars, added (g)",
			requiredForManualEntry: false,
		},
		{
			dedupeKey: "macros:required-basics:protein-g",
			nutrientId: 1003,
			nutrientName: "Protein",
			nutrientNumber: "203",
			unitName: "g",
			nutrientType: "macro",
			step: "macros" as const,
			group: "Macros",
			groupSort: 10,
			sort: 60,
			label: "Protein (g)",
			requiredForManualEntry: true,
		},
		{
			dedupeKey: "macros:required-basics:sodium-mg",
			nutrientId: 1093,
			nutrientName: "Sodium",
			nutrientNumber: "307",
			unitName: "mg",
			nutrientType: "mineral",
			step: "macros" as const,
			group: "Macros",
			groupSort: 10,
			sort: 70,
			label: "Sodium (mg)",
			requiredForManualEntry: true,
		},
	];

	return {
		readManualEntryNutrientGroups: vi.fn().mockResolvedValue({
			macros: [{ title: "Macros", fields: macros }],
			extended: [],
		}),
	};
});

vi.mock("$lib/utils/food/nutrients/nutrientDefinitions", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("$lib/utils/food/nutrients/nutrientDefinitions")>();
	return {
		...actual,
		readManualEntryNutrientGroups:
			foodMetadataMocks.readManualEntryNutrientGroups,
	};
});

vi.mock("$lib/utils/food/ocr/nutritionLabelOcrMappings", () => ({
	readNutritionLabelOcrMappings: vi.fn().mockResolvedValue([
		{
			alias: "calories",
			sourceUnitName: "kcal",
			nutrientId: 1008,
			nutrientName: "Calories",
			targetUnitName: "kcal",
			priority: 1,
			conversionMultiplier: null,
		},
	]),
}));

const categoryPickerMocks = vi.hoisted(() => ({
	loadFoodCategoryPickerData: vi.fn().mockResolvedValue({
		suggestions: [],
		common: [
			{
				id: "other",
				label: "Other",
				observationCount: 1,
				sourceCount: 1,
				verificationStatus: "single_source",
			},
			{
				id: "jams",
				label: "Jams",
				observationCount: 1,
				sourceCount: 1,
				verificationStatus: "single_source",
			},
		],
		results: [],
	}),
}));

vi.mock("$lib/utils/food/categories/categoryPicker", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("$lib/utils/food/categories/categoryPicker")>();
	return {
		...actual,
		loadFoodCategoryPickerData: categoryPickerMocks.loadFoodCategoryPickerData,
	};
});

import CustomIngredientForm from "$lib/components/ingredients/manual-entry/CustomIngredientForm/CustomIngredientForm.svelte";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import { createCustomFood } from "$lib/utils/food/custom/customFoods";
import type { FdcNutrient } from "$lib/utils/food/types";

type TestNutrition = {
	calories: number;
	fat: number;
	carbs: number;
	fiber: number;
	sugar: number;
	protein: number;
	sodium?: number;
};

const makeTestNutrients = (nutrition: TestNutrition): FdcNutrient[] => [
	{
		nutrientId: 1008,
		nutrientName: "Calories",
		nutrientNumber: "208",
		unitName: "kcal",
		value: nutrition.calories,
	},
	{
		nutrientId: 1004,
		nutrientName: "Total Fat",
		nutrientNumber: "204",
		unitName: "g",
		value: nutrition.fat,
	},
	{
		nutrientId: 1005,
		nutrientName: "Total Carbohydrates",
		nutrientNumber: "205",
		unitName: "g",
		value: nutrition.carbs,
	},
	{
		nutrientId: 1079,
		nutrientName: "Dietary Fiber",
		nutrientNumber: "291",
		unitName: "g",
		value: nutrition.fiber,
	},
	{
		nutrientId: 2000,
		nutrientName: "Total Sugars",
		nutrientNumber: "269",
		unitName: "g",
		value: nutrition.sugar,
	},
	{
		nutrientId: 1003,
		nutrientName: "Protein",
		nutrientNumber: "203",
		unitName: "g",
		value: nutrition.protein,
	},
	{
		nutrientId: 1093,
		nutrientName: "Sodium",
		nutrientNumber: "307",
		unitName: "mg",
		value: nutrition.sodium ?? 100,
	},
];

const openManualForm = async () => {
	await fireEvent.click(screen.getByText("Enter manually"));
};

const goToStep = async (name: string | RegExp) => {
	await fireEvent.click(screen.getByRole("tab", { name }));
};

const continueToNextStep = async () => {
	await fireEvent.click(screen.getByRole("button", { name: /continue/i }));
};

const chooseCategory = async (label = "Other") => {
	const trigger = await screen.findByRole("button", { name: "Category" });
	await waitFor(() => expect(trigger).not.toBeDisabled());
	await fireEvent.click(trigger);
	await fireEvent.click(await screen.findByRole("button", { name: label }));
};

const createTestCategoryResolution = (id: string, label: string) => ({
	categoryOptionId: id,
	label,
	sourceValue: label,
	confidence: "exact",
});

const fillIdentityStep = async (name = "Test ingredient") => {
	await fireEvent.input(screen.getByLabelText(/food name/i), {
		target: { value: name },
	});
	await chooseCategory();
};

const openEmptyMacrosStep = async () => {
	await openManualForm();
	await fillIdentityStep();
	await continueToNextStep();
	await fireEvent.input(screen.getByLabelText(/weight \(g\)/i), {
		target: { value: "34" },
	});
	await continueToNextStep();
	await waitFor(() => expect(screen.getByLabelText(/calories/i)).toBeInTheDocument());
};

const fillRequiredCustomIngredient = async (
	name: string,
	options: {
		barcode?: string;
		destination?: string;
		calories?: string;
		fat?: string;
		carbs?: string;
		protein?: string;
		sodium?: string | null;
	} = {},
) => {
	await openManualForm();
	await fireEvent.input(screen.getByLabelText(/food name/i), {
		target: { value: name },
	});
	await chooseCategory();
	if (options.barcode) {
		await fireEvent.input(screen.getByLabelText(/upc \/ barcode/i), {
			target: { value: options.barcode },
		});
	}
	await continueToNextStep();
	await waitFor(() => expect(screen.getByLabelText(/weight \(g\)/i)).toBeInTheDocument());
	await fireEvent.input(screen.getByLabelText(/weight \(g\)/i), {
		target: { value: "34" },
	});
	await continueToNextStep();
	await waitFor(() => expect(screen.getByLabelText(/calories/i)).toBeInTheDocument());
	await fireEvent.input(screen.getByLabelText(/calories/i), {
		target: { value: options.calories ?? "160" },
	});
	await fireEvent.input(screen.getByLabelText(/total fat/i), {
		target: { value: options.fat ?? "6" },
	});
	await fireEvent.input(screen.getByLabelText(/total carbohydrates/i), {
		target: { value: options.carbs ?? "20" },
	});
	await fireEvent.input(screen.getByLabelText(/protein/i), {
		target: { value: options.protein ?? "2" },
	});
	if (options.sodium !== null) {
		await fireEvent.input(screen.getByLabelText(/sodium/i), {
			target: { value: options.sodium ?? "120" },
		});
	}
	await continueToNextStep();
	await continueToNextStep();
	if (options.destination) {
		await fireEvent.change(
			screen.getByRole("combobox", { name: /add after saving/i }),
			{ target: { value: options.destination } },
		);
	}
};

describe("CustomIngredientForm", () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
		vi.clearAllMocks();
		categoryPickerMocks.loadFoodCategoryPickerData.mockResolvedValue({
			suggestions: [],
			common: [
				{
					id: "other",
					label: "Other",
					observationCount: 1,
					sourceCount: 1,
					verificationStatus: "single_source",
				},
				{
					id: "jams",
					label: "Jams",
					observationCount: 1,
					sourceCount: 1,
					verificationStatus: "single_source",
				},
			],
			results: [],
		});
		customFoodMocks.saveCustomFood.mockResolvedValue("saved");
		customFoodMocks.findCustomFoodByBarcode.mockReturnValue(null);
		customFoodMocks.findCustomFoodByName.mockReturnValue(null);
		smoothieListMocks.addFoodToSmoothieList.mockResolvedValue("added");
		smoothieListMocks.moveFoodToSmoothieList.mockResolvedValue("moved");
		smoothieListMocks.removeFoodFromSmoothieList.mockResolvedValue("removed");
		submitSharedProduct.mockResolvedValue({
			status: "pending",
			message: "Waiting for review.",
		});
		validateBarcodeProductForSharing.mockResolvedValue({
			status: "not-found",
			barcode: "04006381333931",
		});
		barcodeLookupMocks.lookupBarcodeProduct.mockResolvedValue({
			status: "not-found",
			barcode: "04006381333931",
		});
		nutrientRelationshipMocks.readNutrientRelationshipRules.mockResolvedValue([
			{
				id: "total-sugars-lte-carbs",
				parentNutrientId: 1005,
				childNutrientId: 2000,
				relationship: "child_must_not_exceed_parent",
				severity: "error",
				message: "Total sugars cannot exceed total carbohydrates.",
				requiresParent: true,
				tolerance: 0,
			},
			{
				id: "added-sugars-lte-total-sugars",
				parentNutrientId: 2000,
				childNutrientId: 1235,
				relationship: "child_must_not_exceed_parent",
				severity: "error",
				message: "Added sugars cannot exceed total sugars.",
				requiresParent: true,
				tolerance: 0,
			},
		]);
	});

	it("requires an ingredient name before saving", async () => {
		render(CustomIngredientForm, {
			props: {
				onCreate: vi.fn(),
			},
		});

		await openManualForm();
		await goToStep(/share/i);

		expect(screen.getByText("Name must be at least 3 characters")).toBeInTheDocument();
	});

	it("restores an unsaved draft after the form remounts", async () => {
		const firstRender = render(CustomIngredientForm, {
			props: { onCreate: vi.fn() },
		});

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/food name/i), {
			target: { value: "QA Recovery Ingredient" },
		});
		await waitFor(() =>
			expect(
				Object.keys(sessionStorage).some((key) =>
					key.includes("blendcalc-manual-entry-draft-v1"),
				),
			).toBe(true),
		);
		firstRender.unmount();

		render(CustomIngredientForm, {
			props: { onCreate: vi.fn() },
		});
		await openManualForm();

		await waitFor(() =>
			expect(screen.getByLabelText(/food name/i)).toHaveValue(
				"QA Recovery Ingredient",
			),
		);
	});

	it("waits for Continue before showing required macro warnings", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openEmptyMacrosStep();
		expect(screen.queryByText("Calories is required")).not.toBeInTheDocument();
		expect(screen.queryByText("Total Fat is required")).not.toBeInTheDocument();

		await continueToNextStep();
		expect(screen.getByText("Calories is required")).toBeInTheDocument();
		expect(screen.getByText("Total Fat is required")).toBeInTheDocument();
	});

	it("treats forward progress-tab navigation as a validation attempt", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openEmptyMacrosStep();
		expect(screen.queryByText("Calories is required")).not.toBeInTheDocument();

		await goToStep(/share/i);
		expect(screen.getByText("Calories is required")).toBeInTheDocument();
		expect(screen.getByText("Total Fat is required")).toBeInTheDocument();
	});

	it("requires a new forward attempt after a previously valid step changes", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openEmptyMacrosStep();
		for (const [label, value] of [
			[/calories/i, "50"],
			[/total fat/i, "0"],
			[/total carbohydrates/i, "13"],
			[/protein/i, "0"],
			[/sodium/i, "0"],
		] as const) {
			await fireEvent.input(screen.getByLabelText(label), {
				target: { value },
			});
		}
		await continueToNextStep();
		await goToStep(/macros/i);
		await fireEvent.input(screen.getByLabelText(/calories/i), {
			target: { value: "" },
		});

		expect(screen.queryByText("Calories is required")).not.toBeInTheDocument();
		await continueToNextStep();
		expect(screen.getByText("Calories is required")).toBeInTheDocument();
	});

	it("keeps barcode scanning visible while manual entry starts collapsed", () => {
		render(CustomIngredientForm, {
			props: {
				onCreate: vi.fn(),
			},
		});

		expect(
			screen.getByRole("button", { name: /scan barcode/i }),
		).toBeVisible();
		expect(screen.getByText("Enter manually").closest("details")).not.toHaveAttribute(
			"open",
		);
		expect(screen.queryByLabelText(/food name/i)).not.toBeVisible();
	});

	it("only offers real list destinations after saving", async () => {
		render(CustomIngredientForm, {
			props: {
				onCreate: vi.fn(),
			},
		});

		await fillRequiredCustomIngredient("List destination snack");

		expect(screen.getByRole("option", { name: "Fridge" })).toBeInTheDocument();
		expect(
			screen.getByRole("option", { name: "Shopping List" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("option", { name: /save only/i }),
		).not.toBeInTheDocument();
	});

	it("creates a custom ingredient from label nutrition values", async () => {
		const onCreate = vi.fn();
		const onClose = vi.fn();
		render(CustomIngredientForm, {
			props: {
				onCreate,
				onClose,
			},
		});

		await fillRequiredCustomIngredient("Chocolate cookies");

		await fireEvent.click(
			screen.getByRole("button", { name: /add ingredient/i }),
		);

		await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
		expect(onCreate.mock.calls[0][0]).toMatchObject({
			description: "Chocolate cookies",
			customFood: true,
			customServingLabel: "34g serving",
			customServingWeightGrams: 34,
		});
		expect(smoothieListMocks.addFoodToSmoothieList).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			expect.objectContaining({ description: "Chocolate cookies" }),
		);
		expect(screen.getByText("Enter manually").closest("details")).not.toHaveAttribute(
			"open",
		);
		expect(onClose).not.toHaveBeenCalled();
	});

	it("requires DB-backed sodium before saving manual nutrition when blank", async () => {
		const onCreate = vi.fn();
		render(CustomIngredientForm, { props: { onCreate } });

		await fillRequiredCustomIngredient("Unsalted test label", {
			sodium: null,
		});

		expect(screen.getAllByText("Sodium is required").length).toBeGreaterThan(0);
		expect(onCreate).not.toHaveBeenCalled();
	});

	it("accepts typed zero values for required manual nutrients", async () => {
		const onCreate = vi.fn();
		render(CustomIngredientForm, { props: { onCreate } });

		await fillRequiredCustomIngredient("Zero fat label", {
			fat: "0",
			protein: "0",
			sodium: "0",
		});
		await fireEvent.click(
			screen.getByRole("button", { name: /add ingredient/i }),
		);

		await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
		const savedNutrients = onCreate.mock.calls[0][0].foodNutrients;
		expect(savedNutrients).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ nutrientId: 1004, value: 0 }),
				expect.objectContaining({ nutrientId: 1003, value: 0 }),
				expect.objectContaining({ nutrientId: 1093, value: 0 }),
			]),
		);
	});

	it("requires choosing a real category instead of the placeholder", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openManualForm();
		const categoryTrigger = await screen.findByRole("button", { name: "Category" });
		expect(categoryTrigger).toHaveTextContent("Choose a category");

		await chooseCategory();
		expect(categoryTrigger).toHaveTextContent("Other");
	});

	it("can add a saved custom ingredient directly to the shopping list", async () => {
		const onCreate = vi.fn();
		render(CustomIngredientForm, {
			props: {
				onCreate,
			},
		});

		await fillRequiredCustomIngredient("Shelf stable snack", {
			destination: MIX_STORAGE_KEYS.shoppingList,
		});
		await fireEvent.click(
			screen.getByRole("button", { name: /add ingredient/i }),
		);

		await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
		expect(smoothieListMocks.addFoodToSmoothieList).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.shoppingList,
			expect.objectContaining({ description: "Shelf stable snack" }),
		);
	});

	it("asks before moving an existing fridge item to shopping", async () => {
		const onCreate = vi.fn();
		smoothieListMocks.addFoodToSmoothieList.mockResolvedValue(
			"move-required:fridge",
		);
		render(CustomIngredientForm, { props: { onCreate } });

		await fillRequiredCustomIngredient("Existing list snack", {
			destination: MIX_STORAGE_KEYS.shoppingList,
		});
		await fireEvent.click(
			screen.getByRole("button", { name: /add ingredient/i }),
		);

		expect(await screen.findByText(/already in Fridge/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Move" })).toBeInTheDocument();
		expect(onCreate).not.toHaveBeenCalled();
	});

	it("moves a confirmed manual-entry item without leaving the old list copy", async () => {
		const onCreate = vi.fn();
		smoothieListMocks.addFoodToSmoothieList.mockResolvedValue(
			"move-required:fridge",
		);
		render(CustomIngredientForm, { props: { onCreate } });

		await fillRequiredCustomIngredient("Confirmed list move", {
			destination: MIX_STORAGE_KEYS.shoppingList,
		});
		await fireEvent.click(
			screen.getByRole("button", { name: /add ingredient/i }),
		);
		await fireEvent.click(await screen.findByRole("button", { name: "Move" }));

		await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
		expect(smoothieListMocks.moveFoodToSmoothieList).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.shoppingList,
			expect.objectContaining({ description: "Confirmed list move" }),
		);
		expect(smoothieListMocks.removeFoodFromSmoothieList).not.toHaveBeenCalled();
	});

	it("normalizes a manually entered barcode before saving", async () => {
		const onCreate = vi.fn();
		render(CustomIngredientForm, { props: { onCreate } });

		await fillRequiredCustomIngredient("Packaged snack", {
			barcode: "4006381333931",
		});
		await fireEvent.click(
			screen.getByRole("button", { name: /add ingredient/i }),
		);

		await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
		expect(onCreate.mock.calls[0][0]).toMatchObject({
			description: "Packaged Snack",
			nameProvenance: "barcode",
			barcode: "04006381333931",
			barcodeSource: "manual",
		});
	});

	it("preserves the name casing for a barcode-free manual item", async () => {
		const onCreate = vi.fn();
		render(CustomIngredientForm, { props: { onCreate } });

		await fillRequiredCustomIngredient("MY PRIVATE TEST FOOD");
		await fireEvent.click(
			screen.getByRole("button", { name: /add ingredient/i }),
		);

		await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
		expect(onCreate.mock.calls[0][0]).toMatchObject({
			description: "MY PRIVATE TEST FOOD",
			nameProvenance: "user",
		});
	});

	it("shows an incomplete barcode warning before lookup", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openManualForm();
		const barcodeInput = screen.getByLabelText(/upc \/ barcode/i);
		await fireEvent.input(barcodeInput, {
			target: { value: "12345" },
		});
		await fireEvent.blur(barcodeInput);

		expect(screen.getByText(/barcode is incomplete/i)).toBeInTheDocument();
		expect(barcodeLookupMocks.lookupBarcodeProduct).not.toHaveBeenCalled();
	});

	it("checks a manually entered barcode without overwriting the typed label", async () => {
		const onCreate = vi.fn();
		barcodeLookupMocks.lookupBarcodeProduct.mockResolvedValue({
			status: "found",
			draft: {
				barcode: "04006381333931",
				name: "Reference tomato product",
				brandOwner: "Reference brand",
				servingLabel: "100g serving",
				servingWeightGrams: 100,
				nutrients: makeTestNutrients({
					calories: 18,
					fat: 0.2,
					carbs: 3.9,
					fiber: 1.2,
					sugar: 2.6,
					protein: 0.9,
					sodium: 5,
				}),
				reportedNutrientIds: [1008, 1004, 1005, 1003],
				categories: ["Other"],
				resolvedCategory: "Other",
				categoryResolution: createTestCategoryResolution("other", "Other"),
				source: "usda",
				sourceLabel: "USDA FDC",
				sourceReference: "12345",
			},
		});

		render(CustomIngredientForm, { props: { onCreate } });

		await fillRequiredCustomIngredient("Typed tomato label", {
			barcode: "4006381333931",
			calories: "120",
			fat: "3",
			carbs: "14",
			protein: "8",
		});

		expect(barcodeLookupMocks.lookupBarcodeProduct).toHaveBeenCalledWith(
			"04006381333931",
		);
		expect(
			screen.getByText(/barcode matched USDA FDC/i),
		).toBeInTheDocument();
		expect(
			screen.getByText(/reviewers can compare it with your typed label/i),
		).toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("button", { name: /add ingredient/i }),
		);

		await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
		expect(onCreate.mock.calls[0][0]).toMatchObject({
			description: "Typed Tomato Label",
			nameProvenance: "barcode",
			barcode: "04006381333931",
			barcodeSource: "manual",
		});
	});

	it("offers optional autofill from a matched manual barcode", async () => {
		const onCreate = vi.fn();
		barcodeLookupMocks.lookupBarcodeProduct.mockResolvedValue({
			status: "found",
				draft: {
					barcode: "04006381333931",
					name: "Source tomato product",
					nameProvenance: "source",
					brandOwner: "Source brand",
				servingLabel: "100g serving",
				servingWeightGrams: 100,
				nutrients: makeTestNutrients({
					calories: 18,
					fat: 0.2,
					carbs: 3.9,
					fiber: 1.2,
					sugar: 2.6,
					protein: 0.9,
					sodium: 5,
				}),
				reportedNutrientIds: [1008, 1004, 1005, 1003],
				categories: ["Other"],
				resolvedCategory: "Other",
				categoryResolution: createTestCategoryResolution("other", "Other"),
				source: "usda",
				sourceLabel: "USDA FDC",
				sourceReference: "12345",
			},
		});

		render(CustomIngredientForm, { props: { onCreate } });

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/food name/i), {
			target: { value: "Typed tomato label" },
		});
		await fireEvent.input(screen.getByLabelText(/upc \/ barcode/i), {
			target: { value: "4006381333931" },
		});

		await waitFor(() =>
			expect(screen.getByRole("button", { name: /autofill/i })).toBeInTheDocument(),
		);

		await fireEvent.click(screen.getByRole("button", { name: /autofill/i }));

		expect(screen.getByText("Share with community")).toBeInTheDocument();
		expect(screen.getByLabelText(/share with community/i)).not.toBeChecked();
		await goToStep(/identity/i);
		expect(screen.getByLabelText(/food name/i)).toHaveValue("Source tomato product");
		expect(screen.getByLabelText(/brand/i)).toHaveValue("Source brand");
		expect(screen.getByText(/autofilled from USDA FDC/i)).toBeInTheDocument();
		await goToStep(/^share$/i);
		await fireEvent.click(
			screen.getByRole("button", { name: /add ingredient/i }),
		);
		await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
		expect(onCreate.mock.calls[0][0]).toMatchObject({
			customFood: false,
			sourceKey: "usda",
		});
	});

	it("keeps unresolved barcode autofill on Identity until a canonical category is chosen", async () => {
		categoryPickerMocks.loadFoodCategoryPickerData.mockResolvedValue({
			suggestions: [
				{
					id: "protein-bars",
					label: "Protein Bars",
					observationCount: 47,
					sourceCount: 1,
					verificationStatus: "single_source",
				},
			],
			common: [],
			results: [],
		});
		barcodeLookupMocks.lookupBarcodeProduct.mockResolvedValue({
			status: "found",
			draft: {
				barcode: "00850000487260",
				name: "Barebells Chocolate Dough Protein Bar",
				nameProvenance: "source",
				brandOwner: "Barebells",
				servingLabel: "1 bar",
				servingWeightGrams: 55,
				nutrients: makeTestNutrients({
					calories: 200,
					fat: 7,
					carbs: 20,
					fiber: 3,
					sugar: 2,
					protein: 20,
					sodium: 180,
				}),
				reportedNutrientIds: [1008, 1004, 1005, 1003, 1093],
				categories: [],
				source: "usda",
				sourceLabel: "USDA FDC",
				sourceReference: "test-protein-bar",
			},
		});

		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });
		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/upc \/ barcode/i), {
			target: { value: "00850000487260" },
		});
		await fireEvent.click(await screen.findByRole("button", { name: /autofill/i }));

		expect(screen.getByLabelText(/food name/i)).toHaveValue(
			"Barebells Chocolate Dough Protein Bar",
		);
		expect(
			screen.getByText(/barcode found, but.*trusted category/i),
		).toBeInTheDocument();
		expect(screen.queryByText(/^please select a category/i)).not.toBeInTheDocument();
		await fireEvent.click(screen.getByRole("button", { name: "Category" }));
		await fireEvent.click(
			await screen.findByRole("button", { name: "Protein Bars" }),
		);
		expect(screen.getByRole("button", { name: "Category" })).toHaveTextContent(
			"Protein Bars",
		);

		await continueToNextStep();
		expect(screen.getByLabelText(/weight \(g\)/i)).toHaveValue(55);
	});

	it("does not offer community sharing when an autofilled catalog product is unchanged", async () => {
		barcodeLookupMocks.lookupBarcodeProduct.mockResolvedValue({
			status: "found",
				draft: {
					barcode: "00021130462506",
					name: "Strawberry Jelly, Strawberry",
					nameProvenance: "source",
					brandOwner: "Safeway, Inc.",
				servingLabel: "50g serving",
				servingWeightGrams: 50,
				nutrients: makeTestNutrients({
					calories: 50,
					fat: 0,
					carbs: 13,
					fiber: 0,
					sugar: 9,
					protein: 0,
					sodium: 0,
				}),
				reportedNutrientIds: [1008, 1004, 1005, 1003, 1093],
				categories: ["Jams"],
				resolvedCategory: "Jams",
				categoryResolution: createTestCategoryResolution("jams", "Jams"),
				source: "shared-catalog",
				sourceLabel: "blendCalc verified catalog",
				sourceReference: "shared-product-1",
			},
		});

		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/upc \/ barcode/i), {
			target: { value: "00021130462506" },
		});
		await waitFor(() =>
			expect(screen.getByRole("button", { name: /autofill/i })).toBeInTheDocument(),
		);
		await fireEvent.click(screen.getByRole("button", { name: /autofill/i }));
		await goToStep(/^share$/i);

		expect(
			screen.getByText(/already exists in blendCalc with matching data/i),
		).toBeInTheDocument();
		expect(screen.queryByLabelText(/share with community/i)).not.toBeInTheDocument();
	});

	it("allows community sharing when a non-name catalog field is edited", async () => {
		const draft = {
				barcode: "00021130462506",
				name: "Strawberry Jelly, Strawberry",
				nameProvenance: "source" as const,
				brandOwner: "Safeway, Inc.",
				servingLabel: "50g serving",
				servingWeightGrams: 50,
				nutrients: makeTestNutrients({
					calories: 50,
					fat: 0,
					carbs: 13,
					fiber: 0,
					sugar: 9,
					protein: 0,
					sodium: 0,
				}),
				reportedNutrientIds: [1008, 1004, 1005, 1003, 1093],
				categories: ["Jams"],
				resolvedCategory: "Jams",
				categoryResolution: createTestCategoryResolution("jams", "Jams"),
				source: "shared-catalog",
				sourceLabel: "blendCalc verified catalog",
				sourceReference: "shared-product-1",
		};
		barcodeLookupMocks.lookupBarcodeProduct.mockResolvedValue({
			status: "found",
			draft,
		});
		validateBarcodeProductForSharing.mockResolvedValue({
			status: "matched",
			barcode: draft.barcode,
			draft,
		});

		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/upc \/ barcode/i), {
			target: { value: "00021130462506" },
		});
		await waitFor(() =>
			expect(screen.getByRole("button", { name: /autofill/i })).toBeInTheDocument(),
		);
		await fireEvent.click(screen.getByRole("button", { name: /autofill/i }));
		await goToStep(/identity/i);
		await fireEvent.input(screen.getByLabelText(/brand/i), {
			target: { value: "Safeway Updated" },
		});
		await goToStep(/^share$/i);

		const shareToggle = screen.getByLabelText(/share with community/i);
		expect(shareToggle).not.toBeDisabled();
		await fireEvent.click(shareToggle);
		await waitFor(() =>
			expect(screen.getByText(/photos for catalog review/i)).toBeInTheDocument(),
		);
	});

	it("blocks sharing when a verified barcode belongs to a different product name", async () => {
		const onCreate = vi.fn();
		const draft = {
			barcode: "00021130462506",
			name: "Strawberry Jelly, Strawberry",
			nameProvenance: "source" as const,
			brandOwner: "Safeway, Inc.",
			servingLabel: "50g serving",
			servingWeightGrams: 50,
			nutrients: makeTestNutrients({
				calories: 50,
				fat: 0,
				carbs: 13,
				fiber: 0,
				sugar: 9,
				protein: 0,
				sodium: 0,
			}),
			reportedNutrientIds: [1008, 1004, 1005, 1003, 1093],
			categories: ["Jams"],
			resolvedCategory: "Jams",
			categoryResolution: createTestCategoryResolution("jams", "Jams"),
			source: "shared-catalog" as const,
			sourceLabel: "blendCalc verified catalog",
			sourceReference: "shared-product-1",
		};
		barcodeLookupMocks.lookupBarcodeProduct.mockResolvedValue({
			status: "found",
			draft,
		});
		validateBarcodeProductForSharing.mockResolvedValue({
			status: "name-mismatch",
			barcode: draft.barcode,
			draft,
			message:
				"This barcode belongs to “Strawberry Jelly, Strawberry”. Use the verified information to share it, or remove the barcode and save your current entry only to your account.",
		});

		render(CustomIngredientForm, { props: { onCreate } });

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/upc \/ barcode/i), {
			target: { value: draft.barcode },
		});
		await waitFor(() =>
			expect(screen.getByRole("button", { name: /autofill/i })).toBeInTheDocument(),
		);
		await fireEvent.click(screen.getByRole("button", { name: /autofill/i }));
		await goToStep(/identity/i);
		await fireEvent.input(screen.getByLabelText(/food name/i), {
			target: { value: "Motor oil" },
		});
		await goToStep(/^share$/i);
		await fireEvent.click(screen.getByLabelText(/share with community/i));

		await waitFor(() =>
			expect(
				screen.getByText(/product name does not match this barcode/i),
			).toBeInTheDocument(),
		);
		expect(screen.queryByText(/photos for catalog review/i)).not.toBeInTheDocument();
		expect(screen.getByLabelText(/share with community/i)).not.toBeChecked();

		await fireEvent.click(
			screen.getByRole("button", { name: /remove barcode.*keep private/i }),
		);
		expect(
			screen.getByText(/barcode removed/i),
		).toBeInTheDocument();
		expect(screen.getByLabelText(/share with community/i)).toBeDisabled();
		await goToStep(/identity/i);
		expect(screen.getByLabelText(/food name/i)).toHaveValue("Motor oil");
		expect(screen.getByLabelText(/upc \/ barcode/i)).toHaveValue("");
		await goToStep(/^share$/i);
		await fireEvent.click(
			screen.getByRole("button", { name: /add ingredient/i }),
		);
		await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
		expect(onCreate.mock.calls[0][0]).toMatchObject({
			description: "Motor oil",
			customFood: true,
		});
	});

	it("replaces a mismatched name with verified barcode information", async () => {
		const draft = {
			barcode: "04006381333931",
			name: "Reference tomato product",
			nameProvenance: "source" as const,
			brandOwner: "Reference brand",
			servingLabel: "100g serving",
			servingWeightGrams: 100,
			nutrients: makeTestNutrients({
				calories: 18,
				fat: 0.2,
				carbs: 3.9,
				fiber: 1.2,
				sugar: 2.6,
				protein: 0.9,
				sodium: 5,
			}),
			reportedNutrientIds: [1008, 1004, 1005, 1003, 1093],
			categories: ["Other"],
			resolvedCategory: "Other",
			categoryResolution: createTestCategoryResolution("other", "Other"),
			source: "usda" as const,
			sourceLabel: "USDA FDC",
			sourceReference: "12345",
		};
		validateBarcodeProductForSharing.mockResolvedValue({
			status: "name-mismatch",
			barcode: draft.barcode,
			draft,
			message: `This barcode belongs to “${draft.name}”.`,
		});

		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });
		await fillRequiredCustomIngredient("Motor oil", {
			barcode: "4006381333931",
		});
		await fireEvent.click(screen.getByLabelText(/share with community/i));
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: /use verified information/i }),
			).toBeInTheDocument(),
		);
		await fireEvent.click(
			screen.getByRole("button", { name: /use verified information/i }),
		);

		await goToStep(/identity/i);
		expect(screen.getByLabelText(/food name/i)).toHaveValue(draft.name);
	});

	it("clears required nutrient warnings when barcode autofill fills reported zero values", async () => {
		barcodeLookupMocks.lookupBarcodeProduct.mockResolvedValue({
			status: "found",
				draft: {
					barcode: "04006381333931",
					name: "Zero macro source product",
					nameProvenance: "source",
					brandOwner: "Source brand",
				servingLabel: "100g serving",
				servingWeightGrams: 100,
				nutrients: makeTestNutrients({
					calories: 50,
					fat: 0,
					carbs: 13,
					fiber: 0,
					sugar: 0,
					protein: 0,
					sodium: 0,
				}),
				reportedNutrientIds: [1008, 1004, 1005, 1003, 1093],
				categories: ["Other"],
				resolvedCategory: "Other",
				categoryResolution: createTestCategoryResolution("other", "Other"),
				source: "usda",
				sourceLabel: "USDA FDC",
				sourceReference: "12345",
			},
		});

		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openManualForm();
		await fillIdentityStep("Typed zero macro label");
		await continueToNextStep();
		await fireEvent.input(screen.getByLabelText(/weight \(g\)/i), {
			target: { value: "100" },
		});
		await continueToNextStep();
		await waitFor(() =>
			expect(screen.getByLabelText(/calories/i)).toBeInTheDocument(),
		);
		await continueToNextStep();

		expect(screen.getAllByText("Total Fat is required").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Protein is required").length).toBeGreaterThan(0);
		expect(screen.getAllByText(/sodium.*is required/i).length).toBeGreaterThan(0);

		await goToStep(/identity/i);
		await fireEvent.input(screen.getByLabelText(/upc \/ barcode/i), {
			target: { value: "4006381333931" },
		});
		await waitFor(() =>
			expect(screen.getByRole("button", { name: /autofill/i })).toBeInTheDocument(),
		);
		await fireEvent.click(screen.getByRole("button", { name: /autofill/i }));
		await goToStep(/macros/i);

		await waitFor(() => {
			expect(screen.queryByText("Total Fat is required")).not.toBeInTheDocument();
			expect(screen.queryByText("Protein is required")).not.toBeInTheDocument();
			expect(screen.queryByText(/sodium.*is required/i)).not.toBeInTheDocument();
		});
		expect(screen.getByLabelText(/total fat/i)).toHaveValue(0);
		expect(screen.getByLabelText(/protein/i)).toHaveValue(0);
		expect(screen.getByLabelText(/sodium/i)).toHaveValue(0);
	});

	it("passes a moderator review flag when shared manual barcode data ignores a source match", async () => {
		const onCreate = vi.fn();
		barcodeLookupMocks.lookupBarcodeProduct.mockResolvedValue({
			status: "found",
				draft: {
					barcode: "04006381333931",
					name: "Reference tomato product",
					nameProvenance: "source",
					brandOwner: "Reference brand",
				servingLabel: "100g serving",
				servingWeightGrams: 100,
				nutrients: makeTestNutrients({
					calories: 18,
					fat: 0.2,
					carbs: 3.9,
					fiber: 1.2,
					sugar: 2.6,
					protein: 0.9,
					sodium: 5,
				}),
				reportedNutrientIds: [1008, 1004, 1005, 1003],
				source: "usda",
				sourceLabel: "USDA FDC",
				sourceReference: "12345",
			},
		});

		render(CustomIngredientForm, { props: { onCreate } });

		await fillRequiredCustomIngredient("Typed tomato label", {
			barcode: "4006381333931",
			calories: "120",
			fat: "3",
			carbs: "14",
			protein: "8",
		});
		await fireEvent.click(screen.getByLabelText(/share with community/i));
		const photo = new File([new Uint8Array([0xff, 0xd8, 0xff])], "label.jpg", {
			type: "image/jpeg",
		});
		for (const label of [
			/front of package/i,
			/nutrition facts label/i,
			/^barcode$/i,
		]) {
			await fireEvent.change(screen.getByLabelText(label), {
				target: { files: [photo] },
			});
		}

		await fireEvent.click(
			screen.getByRole("button", { name: /add ingredient/i }),
		);

		await waitFor(() => expect(submitSharedProduct).toHaveBeenCalledOnce());
		expect(submitSharedProduct.mock.calls[0][2]).toMatchObject({
			reviewFlags: [
				expect.stringContaining(
					"User chose to share manually entered product data instead of autofilling from USDA FDC",
				),
			],
		});
		expect(onCreate).toHaveBeenCalledOnce();
	});

	it("keeps volume conversion off until the user enables it", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openManualForm();
		expect(screen.queryByLabelText(/volume in this serving/i)).not.toBeInTheDocument();

		await fillIdentityStep("Volume test food");
		await continueToNextStep();
		expect(screen.queryByLabelText(/volume in this serving/i)).not.toBeInTheDocument();

		await fireEvent.click(screen.getByLabelText(/label includes volume/i));
		expect(screen.getByLabelText(/volume in this serving/i)).toBeInTheDocument();
		expect(screen.getByText(/records the entered volume as weighing/i)).toBeInTheDocument();
	});

	it("requires volume amount before leaving servings when label includes volume", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openManualForm();
		await fillIdentityStep("Liquid yogurt");
		await continueToNextStep();
		await fireEvent.click(screen.getByLabelText(/label includes volume/i));
		await fireEvent.input(screen.getByLabelText(/weight \(g\)/i), {
			target: { value: "245" },
		});
		await continueToNextStep();

		const warning = screen.getByText(
			/enter a volume amount or turn off label includes volume/i,
		);
		expect(warning).toBeInTheDocument();
		expect(warning.closest(".warning-popup")).toHaveClass("warning-popup--error");
		expect(screen.getByLabelText(/volume in this serving/i)).toBeInTheDocument();
	});

	it("blocks impossible nutrient relationships from DB-backed rules", async () => {
		const onCreate = vi.fn();
		render(CustomIngredientForm, { props: { onCreate } });

		await fillRequiredCustomIngredient("Too sweet label", {
			carbs: "20",
		});
		await goToStep(/macros/i);
		await fireEvent.input(screen.getByLabelText(/^total sugars/i), {
			target: { value: "6" },
		});
		await fireEvent.input(screen.getByLabelText(/sugars, added/i), {
			target: { value: "9" },
		});
		await goToStep("Share");

		expect(onCreate).not.toHaveBeenCalled();
		expect(
			screen.getAllByText("Added sugars cannot exceed total sugars.").length,
		).toBeGreaterThan(0);
	});

	it("blocks forward step navigation until the current step required fields are valid", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openManualForm();
		await continueToNextStep();

		expect(screen.getByText("Name must be at least 3 characters")).toBeInTheDocument();
		expect(screen.getByLabelText(/food name/i)).toBeInTheDocument();

		await fillIdentityStep("Step guard food");
		await continueToNextStep();
		await waitFor(() => expect(screen.getByLabelText(/weight \(g\)/i)).toBeInTheDocument());

		await fireEvent.input(screen.getByLabelText(/weight \(g\)/i), {
			target: { value: "0" },
		});
		await continueToNextStep();

		expect(screen.getByText("Serving weight is required")).toBeInTheDocument();
		expect(screen.getByLabelText(/weight \(g\)/i)).toBeInTheDocument();

		await fireEvent.click(screen.getAllByRole("button", { name: /back/i }).at(-1)!);
		expect(screen.getByLabelText(/food name/i)).toBeInTheDocument();
	});

	it("shares a barcoded label only after explicit consent", async () => {
		const onCreate = vi.fn();
		render(CustomIngredientForm, { props: { onCreate } });

		await fillRequiredCustomIngredient("New packaged food", {
			barcode: "4006381333931",
		});

		expect(submitSharedProduct).not.toHaveBeenCalled();
		await fireEvent.click(
			screen.getByLabelText(/share with community/i),
		);
		const photo = new File([new Uint8Array([0xff, 0xd8, 0xff])], "label.jpg", {
			type: "image/jpeg",
		});
		for (const label of [
			/front of package/i,
			/nutrition facts label/i,
			/^barcode$/i,
		]) {
			await fireEvent.change(screen.getByLabelText(label), {
				target: { files: [photo] },
			});
		}
		await fireEvent.click(
			screen.getByRole("button", { name: /add ingredient/i }),
		);

		await waitFor(() => expect(submitSharedProduct).toHaveBeenCalledOnce());
		expect(onCreate).toHaveBeenCalledOnce();
	});

	it("requires package evidence before sharing an unknown product", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await fillRequiredCustomIngredient("Unknown packaged food", {
			barcode: "4006381333931",
		});
		await fireEvent.click(
			screen.getByLabelText(/share with community/i),
		);
		await fireEvent.click(
			screen.getByRole("button", { name: /add ingredient/i }),
		);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Add front package, nutrition label, and barcode photos",
		);
		expect(submitSharedProduct).not.toHaveBeenCalled();
	});

	it("uses an existing custom ingredient instead of failing duplicate names", async () => {
		const existingFood = createCustomFood({
			name: "Honey greek yogurt",
			servingWeightGrams: 170,
			nutrients: makeTestNutrients({
				calories: 140,
				fat: 2,
				carbs: 18,
				fiber: 0,
				sugar: 14,
				protein: 15,
			}),
		});
		const onCreate = vi.fn();
		customFoodMocks.saveCustomFood.mockResolvedValue("duplicate-name");
		customFoodMocks.findCustomFoodByName.mockReturnValue(existingFood);

		render(CustomIngredientForm, { props: { onCreate } });

		await fillRequiredCustomIngredient("Honey greek yogurt");
		await fireEvent.click(
			screen.getByRole("button", { name: /add ingredient/i }),
		);

		await waitFor(() =>
			expect(onCreate).toHaveBeenCalledWith(existingFood, {
				addedToList: true,
				destination: MIX_STORAGE_KEYS.fridge,
				source: "manual-entry",
			}),
		);
		expect(smoothieListMocks.addFoodToSmoothieList).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			existingFood,
		);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(screen.getByText("Enter manually").closest("details")).not.toHaveAttribute(
			"open",
		);
	});

	it("can be closed and reopened without clearing unfinished input", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		const toggle = screen.getByText("Enter manually");
		const panel = toggle.closest("details");
		expect(panel).not.toHaveAttribute("open");

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/food name/i), {
			target: { value: "Unfinished ingredient" },
		});
		expect(panel).toHaveAttribute("open");

		await fireEvent.click(toggle);
		expect(panel).not.toHaveAttribute("open");

		await fireEvent.click(toggle);
		expect(screen.getByLabelText(/food name/i)).toHaveValue(
			"Unfinished ingredient",
		);
	});
});
