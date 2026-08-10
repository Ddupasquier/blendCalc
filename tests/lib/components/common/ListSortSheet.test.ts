import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ListSortSheet from "$lib/components/common/lists/ListSortSheet/ListSortSheet.svelte";

describe("ListSortSheet", () => {
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
