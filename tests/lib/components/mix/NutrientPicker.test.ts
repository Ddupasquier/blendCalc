import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import NutrientPicker from "$lib/components/mix/controls/NutrientPicker/NutrientPicker.svelte";

const calorieGoal = {
	nutrientId: 1008,
	goalType: "exact" as const,
	targetAmount: 350,
	upperAmount: null,
	toleranceRatio: 0.1,
	importanceWeight: 1,
	sortOrder: 1,
};

describe("NutrientPicker", () => {
	it("uses the shared disclosure and list search to select a DB-backed nutrient", async () => {
		const onSelect = vi.fn().mockReturnValue(true);
		render(NutrientPicker, {
			props: {
				excludedIds: [],
				getGoal: (nutrient) =>
					Number(nutrient.id) === calorieGoal.nutrientId ? calorieGoal : null,
				onSelect,
			},
		});

		const disclosure = screen.getByText("Add nutrient").closest("details");
		expect(disclosure).not.toHaveAttribute("open");

		await fireEvent.click(
			screen.getByText("Add nutrient").closest("summary") as HTMLElement,
		);
		expect(disclosure).toHaveAttribute("open");

		const search = screen.getByRole("searchbox", { name: "Find a nutrient" });
		await fireEvent.input(search, { target: { value: "calories" } });

		const results = screen.getByLabelText("Available nutrients");
		const calories = within(results).getByRole("button", {
			name: "Calories kcal",
		});
		await fireEvent.click(calories);

		expect(onSelect).toHaveBeenCalledWith(1008);
		expect(search).toHaveValue("");
	});

	it("requires an explicit target when no reviewed nutrient default exists", async () => {
		const onSelect = vi.fn().mockReturnValue(true);
		render(NutrientPicker, {
			props: {
				excludedIds: [],
				getGoal: () => null,
				onSelect,
			},
		});

		await fireEvent.click(
			screen.getByText("Add nutrient").closest("summary") as HTMLElement,
		);
		await fireEvent.input(
			screen.getByRole("searchbox", { name: "Find a nutrient" }),
			{ target: { value: "magnesium" } },
		);
		await fireEvent.click(
			screen.getByRole("button", { name: "Magnesium mg" }),
		);

		expect(onSelect).not.toHaveBeenCalled();
		expect(
			screen.getByText("There is no reviewed default for this nutrient. Enter the target you want Mix to track."),
		).toBeInTheDocument();
		await fireEvent.input(
			screen.getByRole("spinbutton", {
				name: "Goal value for Magnesium in mg",
			}),
			{ target: { value: "125" } },
		);
		await fireEvent.click(screen.getByRole("button", { name: "Add goal" }));

		expect(onSelect).toHaveBeenCalledWith(1090, 125);
	});

	it("keeps excluded nutrients out of the searchable choices", async () => {
		render(NutrientPicker, {
			props: {
				excludedIds: [1090],
				getGoal: () => null,
				onSelect: vi.fn(),
			},
		});

		await fireEvent.click(
			screen.getByText("Add nutrient").closest("summary") as HTMLElement,
		);
		await fireEvent.input(
			screen.getByRole("searchbox", { name: "Find a nutrient" }),
			{ target: { value: "magnesium" } },
		);

		expect(screen.getByText("No matching nutrients.")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Magnesium mg" }),
		).not.toBeInTheDocument();
	});

	it("shows the complete available catalog before a search instead of a popular subset", async () => {
		render(NutrientPicker, {
			props: {
				excludedIds: [],
				getGoal: () => null,
				onSelect: vi.fn(),
			},
		});

		await fireEvent.click(
			screen.getByText("Add nutrient").closest("summary") as HTMLElement,
		);

		expect(
			screen.getByRole("button", { name: "Magnesium mg" }),
		).toBeInTheDocument();
		expect(screen.getByText(/nutrients$/)).toHaveTextContent(/\d+ nutrients/);
	});
});
