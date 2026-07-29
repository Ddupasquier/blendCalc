import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ListSortSheet from "$lib/components/common/lists/ListSortSheet/ListSortSheet.svelte";

describe("ListSortSheet", () => {
	it("applies the selected sort through the shared sheet pattern", async () => {
		const onApply = vi.fn();
		render(ListSortSheet, {
			props: {
				open: true,
				value: "newest",
				options: [
					{ value: "newest", label: "Newest first" },
					{ value: "oldest", label: "Oldest first" },
					{ value: "name", label: "Name A–Z" },
				],
				titleId: "saved-sort-sheet-title",
				label: "Sort saved drinks",
				onApply,
				onClose: vi.fn(),
			},
		});

		await fireEvent.click(
			screen.getByRole("button", { name: "Name A–Z" }),
		);
		await fireEvent.click(screen.getByRole("button", { name: "Apply" }));

		expect(onApply).toHaveBeenCalledWith("name");
	});
});
