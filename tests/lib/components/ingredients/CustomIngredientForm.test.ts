import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

const customFoodMocks = vi.hoisted(() => ({
	saveCustomFood: vi.fn().mockResolvedValue("saved"),
	findCustomFoodByBarcode: vi.fn().mockReturnValue(null),
	findCustomFoodByName: vi.fn().mockReturnValue(null),
}));

vi.mock("$lib/utils/food/customFoods", async (importOriginal) => {
	const actual = await importOriginal<typeof import("$lib/utils/food/customFoods")>();
	return {
		...actual,
		saveCustomFood: customFoodMocks.saveCustomFood,
		findCustomFoodByBarcode: customFoodMocks.findCustomFoodByBarcode,
		findCustomFoodByName: customFoodMocks.findCustomFoodByName,
	};
});

const smoothieListMocks = vi.hoisted(() => ({
	addFoodToSmoothieList: vi.fn().mockResolvedValue("added"),
	removeFoodFromSmoothieList: vi.fn().mockResolvedValue("removed"),
}));

vi.mock("$lib/utils/storage/smoothieLists", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("$lib/utils/storage/smoothieLists")>();
	return {
		...actual,
		addFoodToSmoothieList: smoothieListMocks.addFoodToSmoothieList,
		removeFoodFromSmoothieList: smoothieListMocks.removeFoodFromSmoothieList,
	};
});

const { submitSharedProduct } = vi.hoisted(() => ({
	submitSharedProduct: vi.fn().mockResolvedValue({
		status: "pending",
		message: "Waiting for review.",
	}),
}));

vi.mock("$lib/utils/products/catalog", () => ({
	submitSharedProduct,
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

vi.mock("$lib/utils/food/nutrientRelationshipRules", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("$lib/utils/food/nutrientRelationshipRules")>();
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
		readCustomFoodCategoryOptions: vi.fn().mockResolvedValue([
			{
				id: "other",
				label: "Other",
				observation_count: 1,
				source_count: 1,
			},
		]),
	};
});

vi.mock("$lib/utils/food/nutrientDefinitions", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("$lib/utils/food/nutrientDefinitions")>();
	return {
		...actual,
		readManualEntryNutrientGroups:
			foodMetadataMocks.readManualEntryNutrientGroups,
	};
});

vi.mock("$lib/utils/food/categoryOptions", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("$lib/utils/food/categoryOptions")>();
	return {
		...actual,
		readCustomFoodCategoryOptions:
			foodMetadataMocks.readCustomFoodCategoryOptions,
	};
});

import CustomIngredientForm from "$lib/components/ingredients/manual-entry/CustomIngredientForm.svelte";
import { MIX_STORAGE_KEYS } from "../../../../src/defaults/mixDefaults";
import { createCustomFood } from "$lib/utils/food/customFoods";
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
	await fireEvent.click(screen.getByRole("button", { name }));
};

const continueToNextStep = async () => {
	await fireEvent.click(screen.getByRole("button", { name: /continue/i }));
};

const fillIdentityStep = async (name = "Test ingredient") => {
	await fireEvent.input(screen.getByLabelText(/food name/i), {
		target: { value: name },
	});
	await waitFor(() => expect(screen.getByLabelText(/category/i)).not.toBeDisabled());
	await fireEvent.change(screen.getByLabelText(/category/i), {
		target: { value: "Other" },
	});
};

const fillRequiredCustomIngredient = async (
	name: string,
	options: {
		barcode?: string;
		destination?: string;
		servingLabel?: string;
		calories?: string;
		fat?: string;
		carbs?: string;
		protein?: string;
		sodium?: string;
	} = {},
) => {
	await openManualForm();
	await fireEvent.input(screen.getByLabelText(/food name/i), {
		target: { value: name },
	});
	await waitFor(() => expect(screen.getByLabelText(/category/i)).not.toBeDisabled());
	await fireEvent.change(screen.getByLabelText(/category/i), {
		target: { value: "Other" },
	});
	if (options.barcode) {
		await fireEvent.input(screen.getByLabelText(/upc \/ barcode/i), {
			target: { value: options.barcode },
		});
	}
	await continueToNextStep();
	await waitFor(() => expect(screen.getByLabelText(/weight \(g\)/i)).toBeInTheDocument());
	if (options.servingLabel) {
		await fireEvent.input(screen.getByLabelText(/serving label/i), {
			target: { value: options.servingLabel },
		});
	}
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
	await fireEvent.input(screen.getByLabelText(/sodium/i), {
		target: { value: options.sodium ?? "120" },
	});
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
		vi.clearAllMocks();
		customFoodMocks.saveCustomFood.mockResolvedValue("saved");
		customFoodMocks.findCustomFoodByBarcode.mockReturnValue(null);
		customFoodMocks.findCustomFoodByName.mockReturnValue(null);
		smoothieListMocks.addFoodToSmoothieList.mockResolvedValue("added");
		smoothieListMocks.removeFoodFromSmoothieList.mockResolvedValue("removed");
		submitSharedProduct.mockResolvedValue({
			status: "pending",
			message: "Waiting for review.",
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

	it("creates a custom ingredient from label nutrition values", async () => {
		const onCreate = vi.fn();
		render(CustomIngredientForm, {
			props: {
				onCreate,
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
	});

	it("requires DB-backed sodium before saving manual nutrition", async () => {
		const onCreate = vi.fn();
		render(CustomIngredientForm, { props: { onCreate } });

		await fillRequiredCustomIngredient("Unsalted test label", {
			sodium: "0",
		});

		expect(screen.getAllByText("Sodium is required").length).toBeGreaterThan(0);
		expect(onCreate).not.toHaveBeenCalled();
	});

	it("requires choosing a real category instead of the placeholder", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openManualForm();
		await waitFor(() => expect(screen.getByLabelText(/category/i)).not.toBeDisabled());
		const categorySelect = screen.getByLabelText(/category/i) as HTMLSelectElement;
		expect(categorySelect.value).toBe("");
		expect(screen.getByRole("option", { name: /example: other/i })).toBeDisabled();

		await fireEvent.change(categorySelect, { target: { value: "Other" } });
		expect(categorySelect.value).toBe("Other");
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
			barcode: "04006381333931",
			barcodeSource: "manual",
		});
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
			description: "Typed tomato label",
			barcode: "04006381333931",
			barcodeSource: "manual",
		});
	});

	it("offers optional autofill from a matched manual barcode", async () => {
		barcodeLookupMocks.lookupBarcodeProduct.mockResolvedValue({
			status: "found",
			draft: {
				barcode: "04006381333931",
				name: "Source tomato product",
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
				source: "usda",
				sourceLabel: "USDA FDC",
				sourceReference: "12345",
			},
		});

		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

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

		expect(screen.getByLabelText(/food name/i)).toHaveValue("Source tomato product");
		expect(screen.getByLabelText(/brand/i)).toHaveValue("Source brand");
		expect(screen.getByText(/autofilled from USDA FDC/i)).toBeInTheDocument();
	});

	it("passes a moderator review flag when shared manual barcode data ignores a source match", async () => {
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

	it("requires volume amount before leaving servings when volume measurements are enabled", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openManualForm();
		await fillIdentityStep("Liquid yogurt");
		await continueToNextStep();
		await fireEvent.click(screen.getByLabelText(/label includes volume/i));
		await fireEvent.input(screen.getByLabelText(/weight \(g\)/i), {
			target: { value: "245" },
		});
		await continueToNextStep();

		expect(
			screen.getByText(/volume amount is required when volume measurements are enabled/i),
		).toBeInTheDocument();
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
		await fireEvent.click(screen.getByRole("button", { name: "Share" }));

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
