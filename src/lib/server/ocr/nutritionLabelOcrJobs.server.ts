import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { createWorker, PSM } from "tesseract.js";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { Database, Json } from "$lib/types/database.types";
import { normalizeImageUpload } from "$lib/server/uploads/normalizeImageUpload.server";
import { readNutritionLabelOcrMappings } from "$lib/utils/food/ocr/nutritionLabelOcrMappings";
import { parseNutritionLabelText } from "$lib/utils/food/ocr/nutritionLabelOcr";
import {
	isNutritionLabelOcrJobResult,
	isNutritionLabelOcrJobStatus,
	NUTRITION_LABEL_OCR_JOB_MAX_DIMENSION,
	NUTRITION_LABEL_OCR_JOB_MAX_INPUT_BYTES,
	NUTRITION_LABEL_OCR_JOB_RETENTION_SECONDS,
	NUTRITION_LABEL_OCR_PROCESSOR_VERSION,
	type NutritionLabelOcrJob,
	type NutritionLabelOcrJobResult,
} from "$lib/utils/food/ocr/nutritionLabelOcrJobs";

export const NUTRITION_LABEL_OCR_TEMPORARY_BUCKET =
	"nutrition-label-ocr-temporary";
export const NUTRITION_LABEL_OCR_SOURCE_MAX_BYTES =
	NUTRITION_LABEL_OCR_JOB_MAX_INPUT_BYTES;
const NUTRITION_LABEL_OCR_TIMEOUT_MILLISECONDS = 30_000;
const NUTRITION_LABEL_OCR_WORKER_IDLE_MILLISECONDS = 20_000;
const NUTRITION_LABEL_OCR_MAX_RESULT_BYTES = 128 * 1024;

type NutritionLabelOcrWorker = Awaited<ReturnType<typeof createWorker>>;
let workerPromise: Promise<NutritionLabelOcrWorker> | null = null;
let workerSequence: Promise<void> = Promise.resolve();
let workerIdleTimer: ReturnType<typeof setTimeout> | undefined;

type NutritionLabelOcrJobRow =
	Database["public"]["Tables"]["nutrition_label_ocr_jobs"]["Row"];
const NUTRITION_LABEL_OCR_JOB_SELECT =
	"id, user_id, storage_path, input_sha256, processor_version, status, attempt_count, claim_token, claimed_at, result, error_code, created_at, updated_at, completed_at, expires_at";

type CreatedNutritionLabelOcrJob = {
	job: NutritionLabelOcrJob;
	shouldEnqueue: boolean;
};

const asJob = (row: NutritionLabelOcrJobRow): NutritionLabelOcrJob => ({
	id: row.id,
	status: isNutritionLabelOcrJobStatus(row.status) ? row.status : "failed",
	result: isNutritionLabelOcrJobResult(row.result) ? row.result : null,
	errorCode: row.error_code,
	expiresAt: row.expires_at,
});

const removeTemporaryImage = async (storagePath: string) => {
	const admin = getSupabaseAdminClient();
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

export const createNutritionLabelOcrJob = async ({
	file,
	userId,
}: {
	file: File;
	userId: string;
}): Promise<CreatedNutritionLabelOcrJob> => {
	if (file.size === 0 || file.size > NUTRITION_LABEL_OCR_SOURCE_MAX_BYTES) {
		throw new Error("invalid-source-size");
	}
	if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
		throw new Error("invalid-source-type");
	}

	const normalized = await normalizeImageUpload({
		bytes: new Uint8Array(await file.arrayBuffer()),
		maximumOutputBytes: NUTRITION_LABEL_OCR_JOB_MAX_INPUT_BYTES,
		maximumWidth: NUTRITION_LABEL_OCR_JOB_MAX_DIMENSION,
		maximumHeight: NUTRITION_LABEL_OCR_JOB_MAX_DIMENSION,
	});
	const inputSha256 = createHash("sha256")
		.update(normalized.bytes)
		.digest("hex");
	const admin = getSupabaseAdminClient();
	const { data: existing, error: existingError } = await admin
		.from("nutrition_label_ocr_jobs")
		.select(NUTRITION_LABEL_OCR_JOB_SELECT)
		.eq("user_id", userId)
		.eq("input_sha256", inputSha256)
		.eq("processor_version", NUTRITION_LABEL_OCR_PROCESSOR_VERSION)
		.maybeSingle();
	if (existingError) throw existingError;

	const now = Date.now();
	if (existing && Date.parse(existing.expires_at) > now) {
		if (
			existing.status === "queued" ||
			existing.status === "running" ||
			existing.status === "completed"
		) {
			return { job: asJob(existing), shouldEnqueue: false };
		}
	}

	const id = existing?.id ?? randomUUID();
	const storagePath = `${userId}/${id}.webp`;
	const expiresAt = new Date(
		now + NUTRITION_LABEL_OCR_JOB_RETENTION_SECONDS * 1000,
	).toISOString();
	const { error: uploadError } = await admin.storage
		.from(NUTRITION_LABEL_OCR_TEMPORARY_BUCKET)
		.upload(storagePath, normalized.bytes, {
			contentType: normalized.contentType,
			cacheControl: "0",
			upsert: Boolean(existing),
		});
	if (uploadError) throw uploadError;

	const resetValues = {
		storage_path: storagePath,
		input_sha256: inputSha256,
		processor_version: NUTRITION_LABEL_OCR_PROCESSOR_VERSION,
		status: "queued" as const,
		attempt_count: 0,
		claim_token: null,
		claimed_at: null,
		result: null,
		error_code: null,
		completed_at: null,
		expires_at: expiresAt,
	};
	const persistence = existing
		? await admin
				.from("nutrition_label_ocr_jobs")
				.update(resetValues)
				.eq("id", id)
				.eq("user_id", userId)
				.select(NUTRITION_LABEL_OCR_JOB_SELECT)
				.single()
		: await admin
				.from("nutrition_label_ocr_jobs")
				.insert({ id, user_id: userId, ...resetValues })
				.select(NUTRITION_LABEL_OCR_JOB_SELECT)
				.single();
	if (persistence.error || !persistence.data) {
		await removeTemporaryImage(storagePath);
		if (!existing && persistence.error?.code === "23505") {
			const { data: racedJob, error: racedJobError } = await admin
				.from("nutrition_label_ocr_jobs")
				.select(NUTRITION_LABEL_OCR_JOB_SELECT)
				.eq("user_id", userId)
				.eq("input_sha256", inputSha256)
				.eq("processor_version", NUTRITION_LABEL_OCR_PROCESSOR_VERSION)
				.single();
			if (!racedJobError && racedJob) {
				return { job: asJob(racedJob), shouldEnqueue: false };
			}
		}
		throw persistence.error ?? new Error("ocr-job-persistence-failed");
	}

	return { job: asJob(persistence.data), shouldEnqueue: true };
};

export const readNutritionLabelOcrJob = async ({
	jobId,
	userId,
}: {
	jobId: string;
	userId: string;
}): Promise<NutritionLabelOcrJob | null> => {
	const admin = getSupabaseAdminClient();
	const { data, error } = await admin
		.from("nutrition_label_ocr_jobs")
		.select(NUTRITION_LABEL_OCR_JOB_SELECT)
		.eq("id", jobId)
		.eq("user_id", userId)
		.maybeSingle();
	if (error) throw error;
	if (!data) return null;
	if (Date.parse(data.expires_at) <= Date.now()) {
		await cancelNutritionLabelOcrJob({ jobId, userId });
		return null;
	}
	return asJob(data);
};

export const cancelNutritionLabelOcrJob = async ({
	jobId,
	userId,
}: {
	jobId: string;
	userId: string;
}) => {
	const admin = getSupabaseAdminClient();
	const { data, error } = await admin
		.from("nutrition_label_ocr_jobs")
		.update({
			status: "cancelled",
			result: null,
			error_code: null,
			completed_at: null,
			claim_token: null,
			claimed_at: null,
		})
		.eq("id", jobId)
		.eq("user_id", userId)
		.select("storage_path")
		.maybeSingle();
	if (error) throw error;
	if (data) await removeTemporaryImage(data.storage_path);
	return Boolean(data);
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

export const processNutritionLabelOcrJob = async (jobId: string) => {
	const admin = getSupabaseAdminClient();
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
		await removeTemporaryImage(job.storage_path);
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
			await removeTemporaryImage(job.storage_path);
			console.warn("[nutrition label OCR] Job reached terminal failure", {
				phase: "recognition",
				reason,
			});
			return { status: "failed" as const };
		}
		throw error;
	}
};

export const failNutritionLabelOcrJobEnqueue = async (jobId: string) => {
	const admin = getSupabaseAdminClient();
	const { data, error } = await admin
		.from("nutrition_label_ocr_jobs")
		.update({
			status: "failed",
			error_code: "queue-unavailable",
			claim_token: null,
			claimed_at: null,
		})
		.eq("id", jobId)
		.eq("status", "queued")
		.select("storage_path")
		.maybeSingle();
	if (error) throw error;
	if (data) await removeTemporaryImage(data.storage_path);
};

export const cleanupExpiredNutritionLabelOcrJobs = async (
	maximumJobs = 100,
) => {
	const admin = getSupabaseAdminClient();
	const boundedMaximum = Math.max(1, Math.min(500, Math.floor(maximumJobs)));
	const { data: expiredJobs, error: lookupError } = await admin
		.from("nutrition_label_ocr_jobs")
		.select("id, storage_path")
		.lte("expires_at", new Date().toISOString())
		.order("expires_at", { ascending: true })
		.limit(boundedMaximum);
	if (lookupError) throw lookupError;
	if (!expiredJobs?.length) return { deleted: 0 };

	const storagePaths = expiredJobs.map((job) => job.storage_path);
	const { error: storageError } = await admin.storage
		.from(NUTRITION_LABEL_OCR_TEMPORARY_BUCKET)
		.remove(storagePaths);
	if (storageError) throw storageError;

	const { error: deleteError } = await admin
		.from("nutrition_label_ocr_jobs")
		.delete()
		.in(
			"id",
			expiredJobs.map((job) => job.id),
		);
	if (deleteError) throw deleteError;
	return { deleted: expiredJobs.length };
};
