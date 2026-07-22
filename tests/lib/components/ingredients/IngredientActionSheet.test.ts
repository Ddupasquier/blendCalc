import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import IngredientActionSheet from "$lib/components/ingredients/sheets/IngredientActionSheet/IngredientActionSheet.svelte";

describe("IngredientActionSheet delete confirmation", () => {
	it("keeps the sheet open and requires a second delete activation", async () => {
		const onRemove = vi.fn();

		render(IngredientActionSheet, {
			props: {
				open: true,
				title: "Spinach, raw",
				removeLabel: "Remove from Fridge",
				onClose: vi.fn(),
				onRename: vi.fn(),
				onRemove,
			},
		});

		await fireEvent.click(
			screen.getByRole("button", { name: "Remove from Fridge" }),
		);

		expect(onRemove).not.toHaveBeenCalled();
		expect(
			screen.getByText("Tap or click delete again to confirm."),
		).toBeVisible();

		await fireEvent.click(
			screen.getByRole("button", {
				name: "Tap again: Remove from Fridge",
			}),
		);

		expect(onRemove).toHaveBeenCalledOnce();
	});
});
