import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import IngredientFilterSheet from "$lib/components/ingredients/sheets/IngredientFilterSheet/IngredientFilterSheet.svelte";

describe("IngredientFilterSheet", () => {
	it("applies warning and recall filters without exposing provider filters", async () => {
		const onApply = vi.fn();
		render(IngredientFilterSheet, {
			props: {
				open: true,
				query: "salad",
				sortValue: "recent",
				sortOptions: [
					{ value: "recent", label: "Newest first" },
					{ value: "name-asc", label: "Name A–Z" },
				],
				safetyFilter: "all",
				onApply,
				onClose: vi.fn(),
			},
		});

		expect(screen.getByRole("button", { name: "Warnings" })).toBeVisible();
		expect(
			screen.getByRole("button", { name: "Active recalls" }),
		).toBeVisible();
		expect(screen.queryByText(/provider/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/review method/i)).not.toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("button", { name: "Active recalls" }),
		);
		await fireEvent.click(screen.getByRole("button", { name: "Apply" }));

		expect(onApply).toHaveBeenCalledWith({
			query: "salad",
			sortValue: "recent",
			safetyFilter: "active-recalls",
		});
	});
});
