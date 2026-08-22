import { fireEvent, render, screen } from "@testing-library/svelte";
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
	onAdd: vi.fn(),
	onClear: vi.fn(),
	onRemove: vi.fn(),
	clearLabel: "Clear allergens",
	customEntryLabel: "Add a specific allergen",
	selectedValues: ["Banana sensitivity"],
	title: "Allergens",
	labelledBy: "allergen-heading",
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
		expect(screen.getByText(/Saved, but not used for automatic checks yet/i))
			.toBeInTheDocument();
	});

	it("renders database options as accessible add actions", async () => {
		const onAdd = vi.fn();
		render(FoodPreferencePicker, { props: { ...baseProps, onAdd } });

		const milkButton = screen.getByRole("button", { name: /Milk/ });
		expect(milkButton).toBeInTheDocument();
		expect(screen.getByLabelText("Add a specific allergen")).toBeInTheDocument();
		await fireEvent.click(milkButton);
		expect(onAdd).toHaveBeenCalledWith("Milk");
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

	it("provides a scoped clear action for the selected group", async () => {
		const onClear = vi.fn();
		render(FoodPreferencePicker, {
			props: { ...baseProps, onClear },
		});

		await fireEvent.click(screen.getByRole("button", { name: "Clear allergens" }));
		expect(onClear).toHaveBeenCalledOnce();
	});

	it("filters larger database-provided choice sets without discarding selections", async () => {
		const options = Array.from({ length: 13 }, (_, index) => ({
			label: index === 12 ? "Sesame" : `Allergen ${index + 1}`,
			normalizedValue: index === 12 ? "sesame" : `allergen-${index + 1}`,
			category: "allergen" as const,
			usageCount: index,
			sourceValues: index === 12 ? ["sesame seed"] : [],
			tagId: `tag-${index + 1}`,
		}));

		render(FoodPreferencePicker, {
			props: { ...baseProps, options },
		});

		await fireEvent.input(
			screen.getByLabelText("Find reviewed allergens"),
			{ target: { value: "sesame" } },
		);

		expect(screen.getByRole("button", { name: /Sesame/ })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /Allergen 1/ }))
			.not.toBeInTheDocument();
	});
});
