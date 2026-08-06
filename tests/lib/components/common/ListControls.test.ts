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
		const searchControl = search.closest(".search-control");
		expect(search).toHaveValue("berry");
		expect(searchControl).toHaveClass("search-control--active");
		expect(screen.getByText("2 of 8 mixes")).toBeInTheDocument();

		await fireEvent.input(search, { target: { value: "green" } });
		await fireEvent.click(
			screen.getByRole("button", { name: "Clear search saved mixes" }),
		);
		await fireEvent.click(
			screen.getByRole("combobox", { name: "Sort saved mixes" }),
		);
		await fireEvent.click(screen.getByRole("option", { name: "Name A–Z" }));

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
		expect(trigger).toHaveAttribute("aria-controls", "saved-sort-sheet-title");
		expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

		await fireEvent.click(trigger);
		expect(onFilterOpen).toHaveBeenCalledOnce();
	});

	it("can omit a redundant resting count while preserving the search control", () => {
		render(ListControls, {
			props: {
				id: "selected-ingredient-search",
				query: "",
				onQueryChange: vi.fn(),
				label: "Find selected ingredients",
				totalCount: 8,
				visibleCount: 8,
				itemLabel: "selected",
				showCount: false,
			},
		});

		expect(
			screen.getByRole("searchbox", { name: "Find selected ingredients" }),
		).toBeInTheDocument();
		expect(screen.queryByText("8 selected")).not.toBeInTheDocument();
	});

	it("can present a caller-defined result summary in the shared count position", () => {
		render(ListControls, {
			props: {
				id: "mix-ingredient-search",
				query: "",
				onQueryChange: vi.fn(),
				totalCount: 12,
				visibleCount: 8,
				resultSummary: "8 available · 3 selected",
			},
		});

		expect(screen.getByText("8 available · 3 selected")).toBeInTheDocument();
		expect(screen.queryByText("8 of 12 items")).not.toBeInTheDocument();
	});
});
