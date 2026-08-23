import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import IngredientActionSheet from "$lib/components/ingredients/sheets/IngredientActionSheet/IngredientActionSheet.svelte";

describe("IngredientActionSheet delete confirmation", () => {
	it("provides a clear non-gesture route into item selection", async () => {
		const onSelectItem = vi.fn();
		render(IngredientActionSheet, {
			props: {
				open: true,
				title: "Spinach, raw",
				removeLabel: "Remove from Fridge",
				onClose: vi.fn(),
				onSelectItem,
				onRename: vi.fn(),
				onRemove: vi.fn(),
			},
		});

		await fireEvent.click(screen.getByRole("button", { name: "Select item" }));
		expect(onSelectItem).toHaveBeenCalledOnce();
	});

	it("groups moderator actions under one crowned heading", () => {
		render(IngredientActionSheet, {
			props: {
				open: true,
				title: "Spinach, raw",
				removeLabel: "Remove from Fridge",
				canAdjustImagePlacement: true,
				onClose: vi.fn(),
				onSelectItem: vi.fn(),
				onAdjustImagePlacement: vi.fn(),
				onRename: vi.fn(),
				onRemove: vi.fn(),
			},
		});

		const group = screen.getByRole("region", { name: "Privileged tools" });
		const action = screen.getByRole("button", { name: "Adjust image placement" });
		const removeAction = screen.getByRole("button", {
			name: "Remove from Fridge",
		});

		expect(group.querySelectorAll(".privileged-action-badge")).toHaveLength(1);
		expect(action.querySelector(".privileged-action-badge")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Rename" }))
			.not.toContainElement(group.querySelector(".privileged-action-badge"));
		expect(removeAction.compareDocumentPosition(group) & 4).toBeTruthy();
	});

	it("keeps the sheet open and requires a second delete activation", async () => {
		const onRemove = vi.fn();

		render(IngredientActionSheet, {
			props: {
				open: true,
				title: "Spinach, raw",
				removeLabel: "Remove from Fridge",
				onClose: vi.fn(),
				onSelectItem: vi.fn(),
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
