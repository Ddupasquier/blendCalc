import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForNutritionLabelOcrJob } from "$lib/utils/food/ocr/nutritionLabelOcrJobs.client";
import {
	isNutritionLabelOcrJobResult,
	type NutritionLabelOcrJob,
} from "$lib/utils/food/ocr/nutritionLabelOcrJobs";

const queuedJob: NutritionLabelOcrJob = {
	id: "90000000-0000-4000-8000-000000000009",
	status: "queued",
	result: null,
	errorCode: null,
	expiresAt: "2026-09-06T12:00:00.000Z",
};

describe("nutrition label OCR job polling", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("backs off until the durable job completes", async () => {
		vi.useFakeTimers();
		const completedJob: NutritionLabelOcrJob = {
			...queuedJob,
			status: "completed",
			result: {
				candidates: [],
				qualitativeFacts: [],
				serving: null,
				confidence: 80,
			},
		};
		const readStatus = vi
			.fn()
			.mockResolvedValueOnce({ ...queuedJob, status: "running" })
			.mockResolvedValueOnce(completedJob);
		const resultPromise = waitForNutritionLabelOcrJob(
			queuedJob,
			undefined,
			readStatus,
		);

		await vi.runAllTimersAsync();
		await expect(resultPromise).resolves.toEqual(completedJob);
		expect(readStatus).toHaveBeenCalledTimes(2);
	});

	it("returns an already completed fingerprint without polling", async () => {
		const readStatus = vi.fn();
		const completedJob = { ...queuedJob, status: "completed" as const };

		await expect(
			waitForNutritionLabelOcrJob(completedJob, undefined, readStatus),
		).resolves.toEqual(completedJob);
		expect(readStatus).not.toHaveBeenCalled();
	});

	it("stops polling when the caller cancels", async () => {
		vi.useFakeTimers();
		const controller = new AbortController();
		const resultPromise = waitForNutritionLabelOcrJob(
			queuedJob,
			controller.signal,
			vi.fn(),
		);
		controller.abort(new DOMException("Cancelled", "AbortError"));

		await expect(resultPromise).rejects.toMatchObject({ name: "AbortError" });
	});
});

describe("nutrition label OCR job result validation", () => {
	it("accepts a bounded structured result", () => {
		expect(
			isNutritionLabelOcrJobResult({
				candidates: [
					{
						nutrientId: 1008,
						nutrientName: "Energy",
						value: 120,
						unitName: "kcal",
					},
				],
				qualitativeFacts: [],
				serving: { label: "1 cup", gramWeight: 240 },
				confidence: 93,
			}),
		).toBe(true);
	});

	it("rejects malformed or unsafe nested values", () => {
		expect(
			isNutritionLabelOcrJobResult({
				candidates: [
					{
						nutrientId: 1008,
						nutrientName: "Energy",
						value: Number.POSITIVE_INFINITY,
						unitName: "kcal",
					},
				],
				qualitativeFacts: [],
				serving: null,
				confidence: 93,
			}),
		).toBe(false);
	});
});
