import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ListSortSheet from "$lib/components/common/lists/ListSortSheet/ListSortSheet.svelte";

describe("ListSortSheet", () => {
	it("uses the sheet title as the only label for sort-only controls", () => {
		render(ListSortSheet, {
			props: {
				open: true,
				value: "recent",
				options: [
					{ value: "recent", label: "Newest first" },
					{ value: "name-asc", label: "Name A–Z" },
				],
				titleId: "saved-sort-sheet-title",
				label: "Sort saved recipes",
				onApply: vi.fn(),
				onClose: vi.fn(),
			},
		});

		expect(
			screen.getAllByRole("heading", { name: /^Sort$/ }),
		).toHaveLength(1);
		expect(screen.getByRole("group", { name: "Sort" })).toBeInTheDocument();
	});

	it("applies optional list filters and sorting together", async () => {
		const onApply = vi.fn();
		render(ListSortSheet, {
			props: {
				open: true,
				value: "recent",
				options: [
					{ value: "recent", label: "Newest first" },
					{ value: "name-asc", label: "Name A–Z" },
				],
				filterValue: "all",
				filterOptions: [
					{ value: "all", label: "All ingredients" },
					{ value: "selected", label: "Selected only" },
				],
				titleId: "mix-filter-sheet-title",
				label: "Filter and sort ingredients",
				onApply,
				onClose: vi.fn(),
			},
		});

		expect(
			screen.getByRole("heading", {
					name: /^Sort$/,
				level: 3,
			}),
		).toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("button", { name: "Selected only" }),
		);
		await fireEvent.click(
			screen.getByRole("button", { name: "Name A–Z" }),
		);
		await fireEvent.click(screen.getByRole("button", { name: "Apply" }));

		expect(onApply).toHaveBeenCalledWith("name-asc", "selected");
	});
});
