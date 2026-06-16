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

import CustomIngredientForm from "$lib/components/ingredients/CustomIngredientForm.svelte";
import { MIX_STORAGE_KEYS } from "../../../../src/defaults/mixDefaults";
import { createCustomFood } from "$lib/utils/food/customFoods";

const openManualForm = async () => {
	await fireEvent.click(screen.getByText("Add manually"));
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
	});

	it("requires an ingredient name before saving", async () => {
		render(CustomIngredientForm, {
			props: {
				onCreate: vi.fn(),
			},
		});

		await openManualForm();
		await fireEvent.click(
			screen.getByRole("button", { name: /save \+ add/i }),
		);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Add a name for this ingredient.",
		);
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
		expect(screen.getByText("Add manually").closest("details")).not.toHaveAttribute(
			"open",
		);
		expect(screen.queryByLabelText(/ingredient name/i)).not.toBeVisible();
	});

	it("creates a custom ingredient from label nutrition values", async () => {
		const onCreate = vi.fn();
		render(CustomIngredientForm, {
			props: {
				onCreate,
			},
		});

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/ingredient name/i), {
			target: { value: "Chocolate cookies" },
		});
		await fireEvent.input(screen.getByLabelText(/serving label/i), {
			target: { value: "3 cookies" },
		});
		await fireEvent.input(screen.getByLabelText(/serving weight/i), {
			target: { value: "34" },
		});
		await fireEvent.input(screen.getByLabelText(/^calories$/i), {
			target: { value: "160" },
		});

		await fireEvent.click(
			screen.getByRole("button", { name: /save \+ add/i }),
		);

		await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
		expect(onCreate.mock.calls[0][0]).toMatchObject({
			description: "Chocolate cookies",
			customFood: true,
			customServingLabel: "3 cookies",
			customServingWeightGrams: 34,
		});
		expect(smoothieListMocks.addFoodToSmoothieList).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			expect.objectContaining({ description: "Chocolate cookies" }),
		);
		expect(screen.getByText(/saved and added to on hand/i)).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /open mix/i })).toHaveAttribute(
			"href",
			"/mix",
		);
		expect(screen.getByText("Add manually").closest("details")).not.toHaveAttribute(
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

		await openManualForm();
		await fireEvent.change(
			screen.getByRole("combobox", { name: /add after saving/i }),
			{ target: { value: MIX_STORAGE_KEYS.shoppingList } },
		);
		await fireEvent.input(screen.getByLabelText(/ingredient name/i), {
			target: { value: "Shelf stable snack" },
		});
		await fireEvent.click(
			screen.getByRole("button", { name: /save \+ add to shopping list/i }),
		);

		await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
		expect(smoothieListMocks.addFoodToSmoothieList).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.shoppingList,
			expect.objectContaining({ description: "Shelf stable snack" }),
		);
	});

	it("can move the last saved ingredient from on hand to shopping", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/ingredient name/i), {
			target: { value: "Moveable snack" },
		});
		await fireEvent.click(
			screen.getByRole("button", { name: /save \+ add/i }),
		);
		await waitFor(() =>
			expect(screen.getByText(/saved and added to on hand/i)).toBeInTheDocument(),
		);

		await fireEvent.click(
			screen.getByRole("button", { name: /move to shopping/i }),
		);

		await waitFor(() =>
			expect(
				screen.getByText(/moveable snack moved to shopping list/i),
			).toBeInTheDocument(),
		);
		expect(smoothieListMocks.addFoodToSmoothieList).toHaveBeenLastCalledWith(
			MIX_STORAGE_KEYS.shoppingList,
			expect.objectContaining({ description: "Moveable snack" }),
		);
		expect(smoothieListMocks.removeFoodFromSmoothieList).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			expect.any(Number),
		);
	});

	it("can undo the last list add while keeping the custom ingredient saved", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/ingredient name/i), {
			target: { value: "Undo snack" },
		});
		await fireEvent.click(
			screen.getByRole("button", { name: /save \+ add/i }),
		);
		await waitFor(() =>
			expect(screen.getByText(/saved and added to on hand/i)).toBeInTheDocument(),
		);

		await fireEvent.click(screen.getByRole("button", { name: /^undo$/i }));

		await waitFor(() =>
			expect(
				screen.getByText(/custom ingredient is still saved/i),
			).toBeInTheDocument(),
		);
		expect(smoothieListMocks.removeFoodFromSmoothieList).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			expect.any(Number),
		);
	});

	it("normalizes a manually entered barcode before saving", async () => {
		const onCreate = vi.fn();
		render(CustomIngredientForm, { props: { onCreate } });

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/ingredient name/i), {
			target: { value: "Packaged snack" },
		});
		await fireEvent.input(screen.getByLabelText(/upc \/ ean barcode/i), {
			target: { value: "4006381333931" },
		});
		await fireEvent.click(
			screen.getByRole("button", { name: /save \+ add/i }),
		);

		await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
		expect(onCreate.mock.calls[0][0]).toMatchObject({
			barcode: "04006381333931",
			barcodeSource: "manual",
		});
	});

	it("keeps volume conversion off until the user enables it", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openManualForm();
		expect(screen.queryByLabelText(/volume in this serving/i)).not.toBeInTheDocument();

		await fireEvent.click(screen.getByLabelText(/allow volume measurements/i));
		expect(screen.getByLabelText(/volume in this serving/i)).toBeInTheDocument();
		expect(screen.getByText(/2 tbsp weighs 32g/i)).toBeInTheDocument();
	});

	it("shares a barcoded label only after explicit consent", async () => {
		const onCreate = vi.fn();
		render(CustomIngredientForm, { props: { onCreate } });

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/ingredient name/i), {
			target: { value: "New packaged food" },
		});
		await fireEvent.input(screen.getByLabelText(/upc \/ ean barcode/i), {
			target: { value: "4006381333931" },
		});

		expect(submitSharedProduct).not.toHaveBeenCalled();
		await fireEvent.click(
			screen.getByLabelText(/help other users find this product/i),
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
			screen.getByRole("button", { name: /save \+ add/i }),
		);

		await waitFor(() => expect(submitSharedProduct).toHaveBeenCalledOnce());
		expect(screen.getByText("Waiting for review.")).toBeInTheDocument();
	});

	it("requires package evidence before sharing an unknown product", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/ingredient name/i), {
			target: { value: "Unknown packaged food" },
		});
		await fireEvent.input(screen.getByLabelText(/upc \/ ean barcode/i), {
			target: { value: "4006381333931" },
		});
		await fireEvent.click(
			screen.getByLabelText(/help other users find this product/i),
		);
		await fireEvent.click(
			screen.getByRole("button", { name: /save \+ add/i }),
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

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/ingredient name/i), {
			target: { value: "Honey greek yogurt" },
		});
		await fireEvent.click(
			screen.getByRole("button", { name: /save \+ add/i }),
		);

		await waitFor(() => expect(onCreate).toHaveBeenCalledWith(existingFood));
		expect(smoothieListMocks.addFoodToSmoothieList).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			existingFood,
		);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(screen.getByText(/already saved and is now in on hand/i)).toBeInTheDocument();
		expect(screen.getByText("Add manually").closest("details")).not.toHaveAttribute(
			"open",
		);
	});

	it("can be closed and reopened without clearing unfinished input", async () => {
		render(CustomIngredientForm, { props: { onCreate: vi.fn() } });

		const toggle = screen.getByText("Add manually");
		const panel = toggle.closest("details");
		expect(panel).not.toHaveAttribute("open");

		await openManualForm();
		await fireEvent.input(screen.getByLabelText(/ingredient name/i), {
			target: { value: "Unfinished ingredient" },
		});
		expect(panel).toHaveAttribute("open");

		await fireEvent.click(toggle);
		expect(panel).not.toHaveAttribute("open");

		await fireEvent.click(toggle);
		expect(screen.getByLabelText(/ingredient name/i)).toHaveValue(
			"Unfinished ingredient",
		);
	});
});
