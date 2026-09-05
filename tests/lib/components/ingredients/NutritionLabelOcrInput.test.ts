import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import NutritionLabelOcrInput from "$lib/components/ingredients/manual-entry/NutritionLabelOcrInput/NutritionLabelOcrInput.svelte";
import type { NutritionLabelOcrMapping } from "$lib/utils/food/ocr/nutritionLabelOcr";
import type { NutritionLabelOcrJobRunner } from "$lib/components/ingredients/manual-entry/NutritionLabelOcrInput/types";

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
		const runJob = vi.fn().mockResolvedValue({
			jobId: "01234567-89ab-4cde-8f01-23456789abcd",
			result: {
				candidates: [
					{
						nutrientId: 1008,
						nutrientName: "Calories",
						value: 120,
						unitName: "KCAL",
						sourceLine: "Calories 120",
						alias: "calories",
					},
					{
						nutrientId: 1004,
						nutrientName: "Total Fat",
						value: 2,
						unitName: "G",
						sourceLine: "Total Fat 2g",
						alias: "total fat",
					},
				],
				qualitativeFacts: [],
				serving: { label: "1 cup", gramWeight: 240 },
				confidence: 91,
			},
		});
		const photo = new File(["label"], "nutrition-label.png", {
			type: "image/png",
		});

		const { rerender } = render(NutritionLabelOcrInput, {
			props: {
				mappings,
				photo: null,
				runJob,
				onPhotoChange,
				onApply,
			},
		});
		const input = screen.getByLabelText("Nutrition facts photo");
		await fireEvent.change(input, { target: { files: [photo] } });
		expect(onPhotoChange).toHaveBeenCalledWith(photo);

		await rerender({ mappings, photo, runJob, onPhotoChange, onApply });
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

	it("keeps the form cancellable while background recognition is running", async () => {
		const runJob: NutritionLabelOcrJobRunner = ({
			onJobId,
			onStatus,
			onUploadProgress,
			signal,
		}) =>
			new Promise<Awaited<ReturnType<NutritionLabelOcrJobRunner>>>(
				(_resolve, reject) => {
					onUploadProgress?.(0.5);
					onJobId?.("01234567-89ab-4cde-8f01-23456789abcd");
					onStatus?.("running");
					signal?.addEventListener("abort", () => reject(signal.reason), {
						once: true,
					});
				},
			);
		const photo = new File(["label"], "nutrition-label.png", {
			type: "image/png",
		});
		render(NutritionLabelOcrInput, {
			props: {
				mappings,
				photo,
				runJob,
				onPhotoChange: vi.fn(),
				onApply: vi.fn(),
			},
		});

		await fireEvent.click(screen.getByRole("button", { name: "Read label" }));
		expect(
			await screen.findByText("Reading the label in the background…"),
		).toBeInTheDocument();
		expect(screen.getByRole("progressbar")).not.toHaveAttribute("value");

		await fireEvent.click(
			screen.getByRole("button", { name: "Stop label scan" }),
		);
		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Read label" }),
			).toBeInTheDocument();
		});
	});
});
