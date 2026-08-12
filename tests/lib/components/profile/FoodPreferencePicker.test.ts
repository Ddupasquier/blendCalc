import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import FoodPreferencePicker from "$lib/components/profile/FoodPreferencePicker/FoodPreferencePicker.svelte";

const baseProps = {
	id: "allergen-preference",
	options: [{
		label: "Milk",
		normalizedValue: "milk",
		category: "allergen" as const,
		usageCount: 1,
		sourceValues: ["milk"],
		tagId: "milk-tag",
	}],
	emptyLabel: "No allergens saved.",
	helper: "Reviewed matches add warnings.",
	onAdd: vi.fn(),
	onRemove: vi.fn(),
	customEntryLabel: "Add a specific allergen",
	selectedValues: ["Banana sensitivity"],
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

	it("renders database options as accessible reviewed choices", () => {
		render(FoodPreferencePicker, { props: baseProps });

		expect(screen.getByRole("checkbox", { name: "Milk" })).toBeInTheDocument();
		expect(screen.getByLabelText("Add a specific allergen")).toBeInTheDocument();
	});

	it("preserves saved custom wording when reviewed reference data is unavailable", () => {
		render(FoodPreferencePicker, {
			props: { ...baseProps, referenceDataUnavailable: true },
		});

		expect(
			screen.getByRole("button", { name: "Remove Banana sensitivity" }),
		).toBeDisabled();
		expect(screen.getByLabelText("Add a specific allergen")).toBeDisabled();
	});
});
