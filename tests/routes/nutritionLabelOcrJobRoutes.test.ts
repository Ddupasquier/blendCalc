import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createNutritionLabelOcrJob: vi.fn(),
	scheduleNutritionLabelOcrJob: vi.fn(),
	failNutritionLabelOcrJobScheduling: vi.fn(),
	readNutritionLabelOcrJob: vi.fn(),
	cancelNutritionLabelOcrJob: vi.fn(),
}));

vi.mock("$lib/server/ocr/nutritionLabelOcrJobs.server", () => ({
	createNutritionLabelOcrJob: mocks.createNutritionLabelOcrJob,
	failNutritionLabelOcrJobScheduling: mocks.failNutritionLabelOcrJobScheduling,
	readNutritionLabelOcrJob: mocks.readNutritionLabelOcrJob,
	cancelNutritionLabelOcrJob: mocks.cancelNutritionLabelOcrJob,
	NUTRITION_LABEL_OCR_SOURCE_MAX_BYTES: 4 * 1024 * 1024,
}));

vi.mock("$lib/server/ocr/nutritionLabelOcrBackground.server", () => ({
	scheduleNutritionLabelOcrJob: mocks.scheduleNutritionLabelOcrJob,
}));

import {
	config,
	POST,
} from "../../src/routes/api/nutrition-label-ocr/jobs/+server";
import {
	DELETE,
	GET,
} from "../../src/routes/api/nutrition-label-ocr/jobs/[jobId]/+server";

const job = {
	id: "90000000-0000-4000-8000-000000000009",
	status: "queued",
	result: null,
	errorCode: null,
	expiresAt: "2026-09-06T12:00:00.000Z",
};

const locals = (userId: string | null) => ({
	getVerifiedUser: vi.fn().mockResolvedValue(userId ? { id: userId } : null),
});

describe("nutrition label OCR job routes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.createNutritionLabelOcrJob.mockResolvedValue({
			job,
			shouldEnqueue: true,
		});
		mocks.scheduleNutritionLabelOcrJob.mockResolvedValue(undefined);
		mocks.readNutritionLabelOcrJob.mockResolvedValue(job);
		mocks.cancelNutritionLabelOcrJob.mockResolvedValue(true);
	});

	it("creates one owner-scoped job and schedules only its identifier", async () => {
		const formData = new FormData();
		const photo = new File(["label"], "label.png", { type: "image/png" });
		formData.set("photo", photo);
		const response = await POST({
			locals: locals("user-009"),
			request: new Request(
				"http://localhost:5173/api/nutrition-label-ocr/jobs",
				{ method: "POST", body: formData },
			),
		} as never);

		expect(response.status).toBe(202);
		expect(mocks.createNutritionLabelOcrJob).toHaveBeenCalledWith({
			file: expect.objectContaining({ name: "label.png", type: "image/png" }),
			userId: "user-009",
		});
		expect(mocks.scheduleNutritionLabelOcrJob).toHaveBeenCalledWith(job.id);
		expect(await response.json()).toEqual({ job });
	});

	it("gives hosted background recognition a bounded dedicated function", () => {
		expect(config).toEqual({
			runtime: "nodejs24.x",
			regions: ["pdx1"],
			maxDuration: 60,
			memory: 1024,
			split: true,
		});
	});

	it("reuses a completed fingerprint without scheduling another background job", async () => {
		mocks.createNutritionLabelOcrJob.mockResolvedValue({
			job: {
				...job,
				status: "completed",
				result: {
					candidates: [],
					qualitativeFacts: [],
					serving: null,
					confidence: 0,
				},
			},
			shouldEnqueue: false,
		});
		const formData = new FormData();
		formData.set(
			"photo",
			new File(["same"], "label.webp", { type: "image/webp" }),
		);
		const response = await POST({
			locals: locals("user-009"),
			request: new Request("http://localhost/api/nutrition-label-ocr/jobs", {
				method: "POST",
				body: formData,
			}),
		} as never);

		expect(response.status).toBe(200);
		expect(mocks.scheduleNutritionLabelOcrJob).not.toHaveBeenCalled();
	});

	it("removes the temporary job when background scheduling is unavailable", async () => {
		mocks.scheduleNutritionLabelOcrJob.mockRejectedValue(new Error("offline"));
		const formData = new FormData();
		formData.set(
			"photo",
			new File(["label"], "label.png", { type: "image/png" }),
		);
		const response = await POST({
			locals: locals("user-009"),
			request: new Request("http://localhost/api/nutrition-label-ocr/jobs", {
				method: "POST",
				body: formData,
			}),
		} as never);

		expect(response.status).toBe(503);
		expect(mocks.failNutritionLabelOcrJobScheduling).toHaveBeenCalledWith(
			job.id,
		);
	});

	it("reads and cancels only through the authenticated owner", async () => {
		const event = {
			locals: locals("user-009"),
			params: { jobId: job.id },
		};
		const readResponse = await GET(event as never);
		const deleteResponse = await DELETE(event as never);

		expect(readResponse.status).toBe(200);
		expect(deleteResponse.status).toBe(204);
		expect(mocks.readNutritionLabelOcrJob).toHaveBeenCalledWith({
			jobId: job.id,
			userId: "user-009",
		});
		expect(mocks.cancelNutritionLabelOcrJob).toHaveBeenCalledWith({
			jobId: job.id,
			userId: "user-009",
		});
	});

	it("rejects signed-out creation and status reads", async () => {
		const createResponse = await POST({
			locals: locals(null),
			request: new Request("http://localhost/api/nutrition-label-ocr/jobs", {
				method: "POST",
			}),
		} as never);
		const readResponse = await GET({
			locals: locals(null),
			params: { jobId: job.id },
		} as never);

		expect(createResponse.status).toBe(401);
		expect(readResponse.status).toBe(401);
		expect(mocks.createNutritionLabelOcrJob).not.toHaveBeenCalled();
	});
});
