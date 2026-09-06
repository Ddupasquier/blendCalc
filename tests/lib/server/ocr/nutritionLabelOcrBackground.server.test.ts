import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	completeServerBackgroundTask: vi.fn(),
	processNutritionLabelOcrJob: vi.fn(),
}));

vi.mock("$app/environment", () => ({ dev: false }));
vi.mock("$lib/server/ocr/nutritionLabelOcrJobs.server", () => ({
	processNutritionLabelOcrJob: mocks.processNutritionLabelOcrJob,
}));
vi.mock("$lib/server/runtime/backgroundTask.server", () => ({
	completeServerBackgroundTask: mocks.completeServerBackgroundTask,
}));

import { scheduleNutritionLabelOcrJob } from "$lib/server/ocr/nutritionLabelOcrBackground.server";

describe("nutrition label OCR background scheduling", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.processNutritionLabelOcrJob.mockResolvedValue({
			status: "completed",
		});
		mocks.completeServerBackgroundTask.mockResolvedValue(undefined);
	});

	it("hands only the durable job work to the hosted background lifetime", async () => {
		await scheduleNutritionLabelOcrJob("90000000-0000-4000-8000-000000000009");

		expect(mocks.processNutritionLabelOcrJob).toHaveBeenCalledWith(
			"90000000-0000-4000-8000-000000000009",
		);
		expect(mocks.completeServerBackgroundTask).toHaveBeenCalledWith(
			expect.any(Promise),
		);
	});

	it("keeps a background processing failure out of the creation response", async () => {
		mocks.processNutritionLabelOcrJob.mockRejectedValue(new Error("offline"));
		const warning = vi
			.spyOn(console, "warn")
			.mockImplementation(() => undefined);

		await expect(
			scheduleNutritionLabelOcrJob("90000000-0000-4000-8000-000000000010"),
		).resolves.toBeUndefined();
		await expect(
			mocks.completeServerBackgroundTask.mock.calls[0]?.[0],
		).resolves.toBeUndefined();
		expect(mocks.processNutritionLabelOcrJob).toHaveBeenCalledTimes(3);
		expect(warning).toHaveBeenCalledWith(
			"[nutrition label OCR] Background job failed",
			{
				phase: "recognition",
				reason: "background-job-failed",
			},
		);

		warning.mockRestore();
	});
});
