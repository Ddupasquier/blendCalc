import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	loadFoodCategoryPickerData: vi.fn(),
}));

vi.mock("$lib/utils/food/categories/categoryPicker", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("$lib/utils/food/categories/categoryPicker")>();
	return {
		...actual,
		loadFoodCategoryPickerData: mocks.loadFoodCategoryPickerData,
	};
});

import FoodCategoryPicker from "$lib/components/ingredients/manual-entry/FoodCategoryPicker/FoodCategoryPicker.svelte";

const proteinBars = {
	id: "protein-bars",
	label: "Protein Bars",
	observationCount: 12,
	sourceCount: 3,
	verificationStatus: "multi_source_verified",
};

const snacks = {
	id: "snacks",
	label: "Snacks",
	observationCount: 40,
	sourceCount: 4,
	verificationStatus: "multi_source_verified",
};

describe("FoodCategoryPicker", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.loadFoodCategoryPickerData.mockImplementation(
			async ({ query }: { query?: string }) =>
				query
					? { suggestions: [], common: [], results: [proteinBars] }
					: { suggestions: [proteinBars], common: [snacks], results: [] },
		);
	});

	const getReadyTrigger = async () => {
		const trigger = screen.getByRole("button", { name: /category/i });
		await waitFor(() => expect(trigger).toBeEnabled());
		return trigger;
	};

	it("shows server-ranked suggestions and returns the canonical option", async () => {
		const onChange = vi.fn();
		render(FoodCategoryPicker, {
			props: {
				selectedId: "",
				selectedLabel: "",
				productName: "Chocolate Dough Protein Bar",
				sourceCategories: [],
				onChange,
			},
		});

		const trigger = await getReadyTrigger();
		expect(trigger).toHaveAttribute("aria-expanded", "false");
		await fireEvent.click(trigger);
		expect(trigger).toHaveAttribute("aria-expanded", "true");
		expect(document.getElementById(trigger.getAttribute("aria-controls") ?? "")).toBeInTheDocument();
		await fireEvent.click(await screen.findByRole("button", { name: "Protein Bars" }));

		expect(onChange).toHaveBeenCalledWith(proteinBars);
		expect(trigger).toHaveFocus();
		expect(trigger).toHaveAttribute("aria-expanded", "false");
	});

	it("searches categories without rendering the full database catalog", async () => {
		render(FoodCategoryPicker, {
			props: {
				selectedId: "",
				selectedLabel: "",
				productName: "Unknown Food",
				sourceCategories: [],
				onChange: vi.fn(),
			},
		});

		await fireEvent.click(await getReadyTrigger());
		await fireEvent.input(screen.getByLabelText("Search categories"), {
			target: { value: "protein bar" },
		});

		await waitFor(
			() => expect(screen.getByRole("button", { name: "Protein Bars" })).toBeInTheDocument(),
			{ timeout: 2000 },
		);
		expect(mocks.loadFoodCategoryPickerData).toHaveBeenLastCalledWith(
			expect.objectContaining({ query: "protein bar" }),
		);
		expect(screen.queryByRole("option")).not.toBeInTheDocument();
	});

	it("closes with Escape, restores trigger focus, and uses the shared warning", async () => {
		const escapedPickerKeydown = vi.fn();
		window.addEventListener("keydown", escapedPickerKeydown);
		render(FoodCategoryPicker, {
			props: {
				selectedId: "",
				selectedLabel: "",
				productName: "Unknown Food",
				sourceCategories: [],
				warningMessage: "Please select a category for this ingredient.",
				onChange: vi.fn(),
			},
		});

		const trigger = await getReadyTrigger();
		const warningId = trigger.getAttribute("aria-describedby");
		expect(warningId).toBeTruthy();
		expect(document.getElementById(warningId ?? "")).toHaveTextContent(
			"Please select a category for this ingredient.",
		);

		await fireEvent.click(trigger);
		const searchInput = screen.getByLabelText("Search categories");
		expect(searchInput).toHaveFocus();
		await fireEvent.keyDown(searchInput, { key: "Escape" });

		expect(trigger).toHaveFocus();
		expect(trigger).toHaveAttribute("aria-expanded", "false");
		expect(escapedPickerKeydown).not.toHaveBeenCalled();
		window.removeEventListener("keydown", escapedPickerKeydown);
	});
});
