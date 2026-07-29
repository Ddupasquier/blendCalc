import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ListControls from "$lib/components/common/lists/ListControls/ListControls.svelte";

describe("ListControls", () => {
	it("keeps search, clear, sort, and result count accessible", async () => {
		const onQueryChange = vi.fn();
		const onFilterChange = vi.fn();
		render(ListControls, {
			props: {
				id: "saved-search",
				query: "berry",
				onQueryChange,
				label: "Search saved mixes",
				totalCount: 8,
				visibleCount: 2,
				itemLabel: "mixes",
				filterLabel: "Sort saved mixes",
				filterValue: "newest",
				filterOptions: [
					{ value: "newest", label: "Newest first" },
					{ value: "name", label: "Name A–Z" },
				],
				onFilterChange,
			},
		});

		const search = screen.getByRole("searchbox", {
			name: "Search saved mixes",
		});
		expect(search).toHaveValue("berry");
		expect(screen.getByText("2 of 8 mixes")).toBeInTheDocument();

		await fireEvent.input(search, { target: { value: "green" } });
		await fireEvent.click(
			screen.getByRole("button", { name: "Clear search saved mixes" }),
		);
		await fireEvent.change(
			screen.getByRole("combobox", { name: "Sort saved mixes" }),
			{ target: { value: "name" } },
		);

		expect(onQueryChange).toHaveBeenNthCalledWith(1, "green");
		expect(onQueryChange).toHaveBeenNthCalledWith(2, "");
		expect(onFilterChange).toHaveBeenCalledWith("name");
	});

	it("can open the shared filter sheet instead of rendering a select", async () => {
		const onFilterOpen = vi.fn();
		render(ListControls, {
			props: {
				id: "saved-search",
				query: "",
				onQueryChange: vi.fn(),
				label: "Search saved mixes",
				totalCount: 8,
				visibleCount: 8,
				itemLabel: "mixes",
				filterLabel: "Sort saved mixes",
				filtersActive: true,
				filterControlsId: "saved-sort-sheet-title",
				onFilterOpen,
			},
		});

		const trigger = screen.getByRole("button", {
			name: "Sort saved mixes",
		});
		expect(trigger).toHaveAttribute("aria-expanded", "true");
		expect(trigger).toHaveAttribute(
			"aria-controls",
			"saved-sort-sheet-title",
		);
		expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

		await fireEvent.click(trigger);
		expect(onFilterOpen).toHaveBeenCalledOnce();
	});
});
