import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import NutrientPicker from "$lib/components/mix/controls/NutrientPicker/NutrientPicker.svelte";

describe("NutrientPicker", () => {
	it("uses the shared disclosure and list search to select a DB-backed nutrient", async () => {
		const onSelect = vi.fn();
		render(NutrientPicker, {
			props: {
				excludedIds: [],
				onSelect,
			},
		});

		const disclosure = screen.getByText("Add nutrient").closest("details");
		expect(disclosure).not.toHaveAttribute("open");

		await fireEvent.click(screen.getByText("Add nutrient").closest("summary") as HTMLElement);
		expect(disclosure).toHaveAttribute("open");

		const search = screen.getByRole("searchbox", { name: "Find a nutrient" });
		await fireEvent.input(search, { target: { value: "magnesium" } });

		const results = screen.getByLabelText("Available nutrients");
		const magnesium = within(results).getByRole("button", {
			name: "Magnesium mg",
		});
		await fireEvent.click(magnesium);

		expect(onSelect).toHaveBeenCalledWith(1090);
		expect(search).toHaveValue("");
	});

	it("keeps excluded nutrients out of the searchable choices", async () => {
		render(NutrientPicker, {
			props: {
				excludedIds: [1090],
				onSelect: vi.fn(),
			},
		});

		await fireEvent.click(screen.getByText("Add nutrient").closest("summary") as HTMLElement);
		await fireEvent.input(
			screen.getByRole("searchbox", { name: "Find a nutrient" }),
			{ target: { value: "magnesium" } },
		);

		expect(screen.getByText("No matching nutrients.")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Magnesium mg" })).not.toBeInTheDocument();
	});
});
