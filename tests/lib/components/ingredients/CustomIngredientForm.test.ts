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

const openManualForm = async () => {
	await fireEvent.click(screen.getByText("Enter manually"));
};

const goToStep = async (name: string | RegExp) => {
	await fireEvent.click(screen.getByRole("button", { name }));
};

const continueToNextStep = async () => {
	await fireEvent.click(screen.getByRole("button", { name: /continue/i }));
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
	} = {},
) => {
	await openManualForm();
	await fireEvent.input(screen.getByLabelText(/food name/i), {
		target: { value: name },
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
				nutrition: {
					calories: 18,
					fat: 0.2,
					carbs: 3.9,
					fiber: 1.2,
					sugar: 2.6,
					protein: 0.9,
				},
				additionalNutrients: [],
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

	it("keeps volume conversion off until the user enables it", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openManualForm();
		expect(screen.queryByLabelText(/volume in this serving/i)).not.toBeInTheDocument();

		await continueToNextStep();
		expect(screen.queryByLabelText(/volume in this serving/i)).not.toBeInTheDocument();

		await fireEvent.click(screen.getByLabelText(/label includes volume/i));
		expect(screen.getByLabelText(/volume in this serving/i)).toBeInTheDocument();
		expect(screen.getByText(/records the entered volume as weighing/i)).toBeInTheDocument();
	});

	it("requires volume amount only when volume measurements are enabled", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/food name/i), {
			target: { value: "Liquid yogurt" },
		});
		await continueToNextStep();
		await fireEvent.click(screen.getByLabelText(/label includes volume/i));
		await fireEvent.input(screen.getByLabelText(/weight \(g\)/i), {
			target: { value: "245" },
		});
		await continueToNextStep();
		await waitFor(() => expect(screen.getByLabelText(/calories/i)).toBeInTheDocument());
		await fireEvent.input(screen.getByLabelText(/calories/i), {
			target: { value: "140" },
		});
		await fireEvent.input(screen.getByLabelText(/total fat/i), {
			target: { value: "4" },
		});
		await fireEvent.input(screen.getByLabelText(/total carbohydrates/i), {
			target: { value: "8" },
		});
		await fireEvent.input(screen.getByLabelText(/protein/i), {
			target: { value: "18" },
		});
		await continueToNextStep();
		await continueToNextStep();

		expect(
			screen.getByText(/volume amount is required when volume measurements are enabled/i),
		).toBeInTheDocument();
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
			nutrition: {
				calories: 140,
				fat: 2,
				carbs: 18,
				fiber: 0,
				sugar: 14,
				protein: 15,
			},
		});
		const onCreate = vi.fn();
		customFoodMocks.saveCustomFood.mockResolvedValue("duplicate-name");
		customFoodMocks.findCustomFoodByName.mockReturnValue(existingFood);

		render(CustomIngredientForm, { props: { onCreate } });

		await fillRequiredCustomIngredient("Honey greek yogurt");
		await fireEvent.click(
			screen.getByRole("button", { name: /add ingredient/i }),
		);

		await waitFor(() => expect(onCreate).toHaveBeenCalledWith(existingFood));
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
