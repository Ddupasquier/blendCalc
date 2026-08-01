import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import FoodPreferencePicker from "$lib/components/profile/FoodPreferencePicker/FoodPreferencePicker.svelte";

const baseProps = {
	availableOptions: ["Milk"],
	emptyLabel: "No allergens saved.",
	filteredOptions: [],
	helper: "Reviewed matches add warnings.",
	onAdd: vi.fn(),
	onRemove: vi.fn(),
	onSearchChange: vi.fn(),
	onSelectChange: vi.fn(),
	searchLabel: "Type your own allergen",
	searchValue: "",
	selectedValues: ["Banana sensitivity"],
	selectLabel: "Common allergens",
	selectValue: "",
	title: "Allergens",
};

describe("FoodPreferencePicker", () => {
	it("keeps unresolved custom text visible without promising a warning", () => {
		render(FoodPreferencePicker, {
			props: {
				...baseProps,
				unresolvedValues: ["Banana sensitivity"],
			},
		});

		expect(screen.getByText("Waiting for review")).toBeInTheDocument();
		expect(screen.getByText(/Banana sensitivity is saved/i))
			.toBeInTheDocument();
		expect(screen.getByText(/warnings will not use it/i))
			.toBeInTheDocument();
	});
});
