import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import NutritionLabelOcrInput from "$lib/components/ingredients/manual-entry/NutritionLabelOcrInput/NutritionLabelOcrInput.svelte";
import type { NutritionLabelOcrMapping } from "$lib/utils/food/ocr/nutritionLabelOcr";

const mappings: NutritionLabelOcrMapping[] = [
	{
		alias: "calories",
		sourceUnitName: "KCAL",
		nutrientId: 1008,
		nutrientName: "Calories",
		targetUnitName: "KCAL",
		priority: 10,
		conversionMultiplier: null,
	},
	{
		alias: "total fat",
		sourceUnitName: "G",
		nutrientId: 1004,
		nutrientName: "Total Fat",
		targetUnitName: "G",
		priority: 10,
		conversionMultiplier: null,
	},
];

describe("NutritionLabelOcrInput", () => {
	it("waits for explicit review before applying recognized values", async () => {
		const onPhotoChange = vi.fn();
		const onApply = vi.fn();
		const recognize = vi.fn().mockResolvedValue({
			text: "Serving size 1 cup (240g)\nCalories 120\nTotal Fat 2g",
			confidence: 91,
		});
		const photo = new File(["label"], "nutrition-label.png", {
			type: "image/png",
		});

		const { rerender } = render(NutritionLabelOcrInput, {
			props: {
				mappings,
				photo: null,
				recognize,
				onPhotoChange,
				onApply,
			},
		});
		const input = screen.getByLabelText(
			"Choose existing nutrition facts photo",
		);
		await fireEvent.change(input, { target: { files: [photo] } });
		expect(onPhotoChange).toHaveBeenCalledWith(photo);

		await rerender({ mappings, photo, recognize, onPhotoChange, onApply });
		await fireEvent.click(screen.getByRole("button", { name: "Read label" }));

		await waitFor(() => {
			expect(screen.getByText("Calories: 120 kcal")).toBeInTheDocument();
		});
		expect(onApply).not.toHaveBeenCalled();

		await fireEvent.click(
			screen.getByRole("button", { name: "Use selected values" }),
		);
		expect(onApply).toHaveBeenCalledWith({
			candidates: [
				expect.objectContaining({ nutrientId: 1008, value: 120 }),
				expect.objectContaining({ nutrientId: 1004, value: 2 }),
			],
			qualitativeFacts: [],
			serving: { label: "1 cup", gramWeight: 240 },
		});
	});
});
