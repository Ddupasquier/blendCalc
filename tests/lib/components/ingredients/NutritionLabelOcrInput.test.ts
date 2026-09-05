import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import NutritionLabelOcrInput from "$lib/components/ingredients/manual-entry/NutritionLabelOcrInput/NutritionLabelOcrInput.svelte";
import type { NutritionLabelOcrJobRunner } from "$lib/components/ingredients/manual-entry/NutritionLabelOcrInput/types";
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

const photo = new File(["label"], "nutrition-label.png", {
	type: "image/png",
});

describe("NutritionLabelOcrInput", () => {
	it("sends the adjusted crop to background recognition and waits for explicit review", async () => {
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
					},
					{
						nutrientId: 1004,
						nutrientName: "Total Fat",
						value: 2,
						unitName: "G",
					},
				],
				qualitativeFacts: [],
				serving: { label: "1 cup", gramWeight: 240 },
				confidence: 91,
			},
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
		await fireEvent.change(
			screen.getByLabelText("Choose existing nutrition facts photo"),
			{ target: { files: [photo] } },
		);
		expect(onPhotoChange).toHaveBeenCalledWith(photo);

		await rerender({ mappings, photo, runJob, onPhotoChange, onApply });
		await fireEvent.input(screen.getByLabelText("Left edge"), {
			target: { value: "20" },
		});
		await fireEvent.click(screen.getByRole("button", { name: "Read label" }));

		await waitFor(() => {
			expect(screen.getByText("Calories: 120 kcal")).toBeInTheDocument();
		});
		expect(onApply).not.toHaveBeenCalled();
		expect(runJob).toHaveBeenCalledWith(
			expect.objectContaining({
				file: photo,
				crop: { left: 0.2, top: 0, right: 1, bottom: 1 },
			}),
		);

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

	it("keeps the crop and form available while background recognition is cancelled", async () => {
		const runJob: NutritionLabelOcrJobRunner = ({
			onPrepared,
			onJobId,
			onStatus,
			onUploadProgress,
			signal,
		}) =>
			new Promise<Awaited<ReturnType<NutritionLabelOcrJobRunner>>>(
				(_resolve, reject) => {
					onPrepared?.();
					onUploadProgress?.(0.5);
					onJobId?.("01234567-89ab-4cde-8f01-23456789abcd");
					onStatus?.("running");
					signal?.addEventListener("abort", () => reject(signal.reason), {
						once: true,
					});
				},
			);
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
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Read label" })).toBeEnabled(),
		);
		expect(
			screen.getByAltText("Selected nutrition label crop preview"),
		).toBeInTheDocument();
		expect(screen.queryByText(/could not be read/i)).not.toBeInTheDocument();
	});

	it("keeps manual entry and the selected crop available after a timeout", async () => {
		const runJob = vi
			.fn()
			.mockRejectedValue(
				new DOMException("Recognition timed out", "TimeoutError"),
			);
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
		await screen.findByText(/The label scan took too long and was stopped/i);
		expect(screen.getByRole("button", { name: "Read label" })).toBeEnabled();
		expect(
			screen.getByAltText("Selected nutrition label crop preview"),
		).toBeInTheDocument();
	});
});
