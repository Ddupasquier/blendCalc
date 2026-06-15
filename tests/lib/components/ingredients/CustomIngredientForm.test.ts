import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/utils/food/customFoods", async (importOriginal) => {
	const actual = await importOriginal<typeof import("$lib/utils/food/customFoods")>();
	return {
		...actual,
		saveCustomFood: vi.fn().mockResolvedValue("saved"),
	};
});

import CustomIngredientForm from "$lib/components/ingredients/CustomIngredientForm.svelte";

describe("CustomIngredientForm", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("requires an ingredient name before saving", async () => {
		render(CustomIngredientForm, {
			props: {
				onCreate: vi.fn(),
			},
		});

		await fireEvent.click(screen.getByText("Enter label details"));
		await fireEvent.click(
			screen.getByRole("button", { name: /save custom ingredient/i }),
		);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Add a name for this ingredient.",
		);
	});

	it("creates a custom ingredient from label nutrition values", async () => {
		const onCreate = vi.fn();
		render(CustomIngredientForm, {
			props: {
				onCreate,
			},
		});

		await fireEvent.click(screen.getByText("Enter label details"));
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
			screen.getByRole("button", { name: /save custom ingredient/i }),
		);

		await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
		expect(onCreate.mock.calls[0][0]).toMatchObject({
			description: "Chocolate cookies",
			customFood: true,
			customServingLabel: "3 cookies",
			customServingWeightGrams: 34,
		});
	});

	it("normalizes a manually entered barcode before saving", async () => {
		const onCreate = vi.fn();
		render(CustomIngredientForm, { props: { onCreate } });

		await fireEvent.click(screen.getByText("Enter label details"));
		await fireEvent.input(screen.getByLabelText(/ingredient name/i), {
			target: { value: "Packaged snack" },
		});
		await fireEvent.input(screen.getByLabelText(/upc \/ ean barcode/i), {
			target: { value: "4006381333931" },
		});
		await fireEvent.click(
			screen.getByRole("button", { name: /save custom ingredient/i }),
		);

		await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
		expect(onCreate.mock.calls[0][0]).toMatchObject({
			barcode: "04006381333931",
			barcodeSource: "manual",
		});
	});
});
