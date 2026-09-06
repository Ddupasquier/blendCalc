import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createWorker: vi.fn(),
	getSupabaseAdminClient: vi.fn(),
	parseNutritionLabelText: vi.fn(),
	readNutritionLabelOcrMappings: vi.fn(),
	sharp: vi.fn(),
}));

vi.mock("tesseract.js", () => ({
	createWorker: mocks.createWorker,
	PSM: { SPARSE_TEXT: "11" },
}));

vi.mock("sharp", () => ({ default: mocks.sharp }));

vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

vi.mock("$lib/utils/food/ocr/nutritionLabelOcrMappings", () => ({
	readNutritionLabelOcrMappings: mocks.readNutritionLabelOcrMappings,
}));

vi.mock("$lib/utils/food/ocr/nutritionLabelOcr", () => ({
	parseNutritionLabelText: mocks.parseNutritionLabelText,
}));

const jobId = "90000000-0000-4000-8000-000000000009";
const claimTokenPattern = /^[0-9a-f-]{36}$/u;

describe("nutrition label OCR background processor", () => {
	let rpc: ReturnType<typeof vi.fn>;
	let remove: ReturnType<typeof vi.fn>;
	let recognize: ReturnType<typeof vi.fn>;
	let terminate: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		remove = vi.fn().mockResolvedValue({ error: null });
		rpc = vi.fn(async (name: string) => {
			if (name === "claim_nutrition_label_ocr_job") {
				return {
					data: [{ storage_path: `owner/${jobId}.webp` }],
					error: null,
				};
			}
			if (name === "complete_nutrition_label_ocr_job") {
				return { data: true, error: null };
			}
			return { data: "failed", error: null };
		});
		mocks.getSupabaseAdminClient.mockReturnValue({
			rpc,
			storage: {
				from: vi.fn(() => ({
					download: vi.fn().mockResolvedValue({
						data: new Blob(["prepared-label"]),
						error: null,
					}),
					remove,
				})),
			},
		});
		mocks.readNutritionLabelOcrMappings.mockResolvedValue([
			{
				alias: "calories",
				sourceUnitName: "KCAL",
				nutrientId: 1008,
				nutrientName: "Calories",
				targetUnitName: "KCAL",
				priority: 10,
				conversionMultiplier: null,
			},
		]);
		mocks.parseNutritionLabelText.mockReturnValue({
			candidates: [
				{
					nutrientId: 1008,
					nutrientName: "Calories",
					value: 120,
					unitName: "KCAL",
					sourceLine: "Calories 120",
					alias: "calories",
				},
			],
			qualitativeFacts: [],
			serving: null,
			confidence: 93,
		});
		const imagePipeline = {
			rotate: vi.fn(),
			resize: vi.fn(),
			grayscale: vi.fn(),
			normalize: vi.fn(),
			sharpen: vi.fn(),
			png: vi.fn(),
			toBuffer: vi.fn().mockResolvedValue(Buffer.from("bounded-label")),
		};
		for (const method of [
			"rotate",
			"resize",
			"grayscale",
			"normalize",
			"sharpen",
			"png",
		] as const) {
			imagePipeline[method].mockReturnValue(imagePipeline);
		}
		mocks.sharp.mockReturnValue(imagePipeline);
		recognize = vi.fn().mockResolvedValue({
			data: { text: "Calories 120", confidence: 93 },
		});
		terminate = vi.fn().mockResolvedValue(undefined);
		mocks.createWorker.mockResolvedValue({
			setParameters: vi.fn().mockResolvedValue(undefined),
			recognize,
			terminate,
		});
	});

	it("claims, recognizes, stores structured suggestions, and removes the crop", async () => {
		const { processNutritionLabelOcrJob } =
			await import("$lib/server/ocr/nutritionLabelOcrJobs.server");

		await expect(processNutritionLabelOcrJob(jobId)).resolves.toEqual({
			status: "completed",
		});
		expect(rpc).toHaveBeenNthCalledWith(
			1,
			"claim_nutrition_label_ocr_job",
			expect.objectContaining({ p_job_id: jobId }),
		);
		expect(rpc.mock.calls[0][1].p_claim_token).toMatch(claimTokenPattern);
		expect(rpc).toHaveBeenNthCalledWith(
			2,
			"complete_nutrition_label_ocr_job",
			expect.objectContaining({
				p_job_id: jobId,
				p_result: expect.objectContaining({
					candidates: [expect.objectContaining({ value: 120 })],
				}),
			}),
		);
		const storedCandidate = rpc.mock.calls[1][1].p_result.candidates[0];
		expect(storedCandidate).not.toHaveProperty("sourceLine");
		expect(storedCandidate).not.toHaveProperty("alias");
		expect(remove).toHaveBeenCalledWith([`owner/${jobId}.webp`]);
	});

	it("briefly reuses one serial worker for consecutive jobs", async () => {
		const { processNutritionLabelOcrJob } =
			await import("$lib/server/ocr/nutritionLabelOcrJobs.server");

		await processNutritionLabelOcrJob(jobId);
		await processNutritionLabelOcrJob("90000000-0000-4000-8000-000000000010");

		expect(mocks.createWorker).toHaveBeenCalledTimes(1);
		expect(recognize).toHaveBeenCalledTimes(2);
		expect(terminate).not.toHaveBeenCalled();
	});

	it("records terminal failure and deletes the temporary crop", async () => {
		recognize.mockRejectedValueOnce(new Error("worker failed"));
		const { processNutritionLabelOcrJob } =
			await import("$lib/server/ocr/nutritionLabelOcrJobs.server");

		await expect(processNutritionLabelOcrJob(jobId)).resolves.toEqual({
			status: "failed",
		});
		expect(rpc).toHaveBeenLastCalledWith(
			"fail_nutrition_label_ocr_job",
			expect.objectContaining({
				p_error_code: "ocr-processing-failed",
				p_job_id: jobId,
			}),
		);
		expect(terminate).toHaveBeenCalledTimes(1);
		expect(remove).toHaveBeenCalledWith([`owner/${jobId}.webp`]);
	});
});
