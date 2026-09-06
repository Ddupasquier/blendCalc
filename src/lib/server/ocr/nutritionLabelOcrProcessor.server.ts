import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { createWorker, PSM } from "tesseract.js";
import type { Database, Json } from "../../types/database.types.js";
import { parseNutritionLabelText } from "../../utils/food/ocr/nutritionLabelOcr.js";
import {
	isNutritionLabelOcrJobResult,
	NUTRITION_LABEL_OCR_JOB_MAX_DIMENSION,
	type NutritionLabelOcrJobResult,
} from "../../utils/food/ocr/nutritionLabelOcrJobs.js";
import { readNutritionLabelOcrMappings } from "../../utils/food/ocr/nutritionLabelOcrMappings.js";

export const NUTRITION_LABEL_OCR_TEMPORARY_BUCKET =
	"nutrition-label-ocr-temporary";

const NUTRITION_LABEL_OCR_TIMEOUT_MILLISECONDS = 30_000;
const NUTRITION_LABEL_OCR_WORKER_IDLE_MILLISECONDS = 20_000;
const NUTRITION_LABEL_OCR_MAX_RESULT_BYTES = 128 * 1024;

type NutritionLabelOcrAdminClient = SupabaseClient<Database>;
type NutritionLabelOcrWorker = Awaited<ReturnType<typeof createWorker>>;

let workerPromise: Promise<NutritionLabelOcrWorker> | null = null;
let workerSequence: Promise<void> = Promise.resolve();
let workerIdleTimer: ReturnType<typeof setTimeout> | undefined;

export const removeNutritionLabelOcrTemporaryImage = async (
	admin: NutritionLabelOcrAdminClient,
	storagePath: string,
) => {
	const { error } = await admin.storage
		.from(NUTRITION_LABEL_OCR_TEMPORARY_BUCKET)
		.remove([storagePath]);
	if (error) {
		console.warn("[nutrition label OCR] Temporary image cleanup failed", {
			phase: "storage-cleanup",
			reason: "storage-delete-failed",
		});
	}
};

const clearWorkerIdleTimer = () => {
	if (!workerIdleTimer) return;
	clearTimeout(workerIdleTimer);
	workerIdleTimer = undefined;
};

const terminateSharedWorker = async () => {
	clearWorkerIdleTimer();
	const currentWorker = workerPromise;
	workerPromise = null;
	if (!currentWorker) return;
	try {
		await (await currentWorker).terminate();
	} catch {
		// A failed or already-terminated worker has no reusable state to preserve.
	}
};

const getSharedWorker = () => {
	if (!workerPromise) {
		workerPromise = createWorker("eng", 1, { logger: () => undefined }).then(
			async (worker) => {
				await worker.setParameters({
					debug_file: "/dev/null",
					preserve_interword_spaces: "1",
					tessedit_pageseg_mode: PSM.SPARSE_TEXT,
				});
				return worker;
			},
		);
	}
	return workerPromise;
};

const scheduleWorkerTermination = () => {
	clearWorkerIdleTimer();
	workerIdleTimer = setTimeout(() => {
		void terminateSharedWorker();
	}, NUTRITION_LABEL_OCR_WORKER_IDLE_MILLISECONDS);
	workerIdleTimer.unref?.();
};

const recognizeNutritionLabel = async (imageBytes: Uint8Array) => {
	const preparedImage = await sharp(imageBytes, { failOn: "warning" })
		.rotate()
		.resize({
			width: NUTRITION_LABEL_OCR_JOB_MAX_DIMENSION,
			height: NUTRITION_LABEL_OCR_JOB_MAX_DIMENSION,
			fit: "inside",
			withoutEnlargement: true,
		})
		.grayscale()
		.normalize()
		.sharpen()
		.png()
		.toBuffer();
	const recognition = workerSequence.then(async () => {
		clearWorkerIdleTimer();
		let timeout: ReturnType<typeof setTimeout> | undefined;
		try {
			const worker = await getSharedWorker();
			const timeoutPromise = new Promise<never>((_, reject) => {
				timeout = setTimeout(
					() => reject(new Error("ocr-timeout")),
					NUTRITION_LABEL_OCR_TIMEOUT_MILLISECONDS,
				);
			});
			const output = await Promise.race([
				worker.recognize(preparedImage, {}, { text: true }),
				timeoutPromise,
			]);
			scheduleWorkerTermination();
			return output.data;
		} catch (error) {
			await terminateSharedWorker();
			throw error;
		} finally {
			if (timeout) clearTimeout(timeout);
		}
	});
	workerSequence = recognition.then(
		() => undefined,
		() => undefined,
	);
	return recognition;
};

export const processNutritionLabelOcrJobWithClient = async (
	jobId: string,
	admin: NutritionLabelOcrAdminClient,
) => {
	const claimToken = randomUUID();
	const { data: claimed, error: claimError } = await admin.rpc(
		"claim_nutrition_label_ocr_job",
		{ p_job_id: jobId, p_claim_token: claimToken },
	);
	if (claimError) throw claimError;
	const job = claimed?.[0];
	if (!job) return { status: "ignored" as const };

	try {
		const [{ data: image, error: downloadError }, mappings] = await Promise.all(
			[
				admin.storage
					.from(NUTRITION_LABEL_OCR_TEMPORARY_BUCKET)
					.download(job.storage_path),
				readNutritionLabelOcrMappings(admin),
			],
		);
		if (downloadError || !image) throw new Error("ocr-image-unavailable");
		if (!mappings?.length) throw new Error("ocr-mappings-unavailable");

		const recognition = await recognizeNutritionLabel(
			new Uint8Array(await image.arrayBuffer()),
		);
		const parsed = parseNutritionLabelText({
			text: recognition.text,
			confidence: recognition.confidence,
			mappings,
		});
		const result: NutritionLabelOcrJobResult = {
			candidates: parsed.candidates.map(
				({ nutrientId, nutrientName, value, unitName }) => ({
					nutrientId,
					nutrientName,
					value,
					unitName,
				}),
			),
			qualitativeFacts: parsed.qualitativeFacts.map((fact) => ({
				...fact,
				statement:
					fact.status === "below-reporting-threshold"
						? fact.maximumAmount === undefined
							? `Not a significant source of ${fact.nutrientName}.`
							: `${fact.nutrientName} is reported below ${fact.maximumAmount} ${fact.unitName}.`
						: `${fact.nutrientName} is present without a reported amount.`,
			})),
			serving: parsed.serving,
			confidence: parsed.confidence,
		};
		if (
			!isNutritionLabelOcrJobResult(result) ||
			Buffer.byteLength(JSON.stringify(result), "utf8") >
				NUTRITION_LABEL_OCR_MAX_RESULT_BYTES
		) {
			throw new Error("ocr-result-invalid");
		}
		const { data: completed, error: completionError } = await admin.rpc(
			"complete_nutrition_label_ocr_job",
			{
				p_job_id: jobId,
				p_claim_token: claimToken,
				p_result: result as unknown as Json,
			},
		);
		if (completionError) throw completionError;
		await removeNutritionLabelOcrTemporaryImage(admin, job.storage_path);
		return {
			status: completed ? ("completed" as const) : ("ignored" as const),
		};
	} catch (error) {
		const reason =
			error instanceof Error &&
			new Set([
				"ocr-timeout",
				"ocr-image-unavailable",
				"ocr-mappings-unavailable",
				"ocr-result-invalid",
			]).has(error.message)
				? error.message
				: "ocr-processing-failed";
		const { data: nextStatus, error: failureError } = await admin.rpc(
			"fail_nutrition_label_ocr_job",
			{
				p_job_id: jobId,
				p_claim_token: claimToken,
				p_error_code: reason,
			},
		);
		if (failureError) throw failureError;
		if (nextStatus === "failed") {
			await removeNutritionLabelOcrTemporaryImage(admin, job.storage_path);
			console.warn("[nutrition label OCR] Job reached terminal failure", {
				phase: "recognition",
				reason,
			});
			return { status: "failed" as const };
		}
		throw error;
	}
};
