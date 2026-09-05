import {
	isNutritionLabelOcrJobResult,
	isNutritionLabelOcrJobStatus,
	NUTRITION_LABEL_OCR_JOB_POLL_INITIAL_MILLISECONDS,
	NUTRITION_LABEL_OCR_JOB_POLL_MAX_MILLISECONDS,
	type NutritionLabelOcrJob,
} from "$lib/utils/food/ocr/nutritionLabelOcrJobs";

type NutritionLabelOcrJobResponse = { job?: unknown };

const readJob = (value: unknown): NutritionLabelOcrJob => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("invalid-ocr-job-response");
	}
	const candidate = value as Record<string, unknown>;
	if (
		typeof candidate.id !== "string" ||
		!isNutritionLabelOcrJobStatus(candidate.status) ||
		(candidate.result !== null &&
			!isNutritionLabelOcrJobResult(candidate.result)) ||
		(candidate.errorCode !== null && typeof candidate.errorCode !== "string") ||
		typeof candidate.expiresAt !== "string"
	) {
		throw new Error("invalid-ocr-job-response");
	}
	return candidate as NutritionLabelOcrJob;
};

const readResponseJob = (body: string) => {
	const response = JSON.parse(body) as NutritionLabelOcrJobResponse;
	return readJob(response.job);
};

export const createNutritionLabelOcrJob = ({
	file,
	onUploadProgress,
	signal,
}: {
	file: File;
	onUploadProgress?: (progress: number | null) => void;
	signal?: AbortSignal;
}): Promise<NutritionLabelOcrJob> => {
	if (signal?.aborted) {
		return Promise.reject(
			signal.reason ?? new DOMException("Label scan cancelled", "AbortError"),
		);
	}
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest();
		const abort = () => request.abort();
		request.open("POST", "/api/nutrition-label-ocr/jobs");
		request.responseType = "text";
		request.withCredentials = true;
		request.upload.onprogress = (event) => {
			onUploadProgress?.(
				event.lengthComputable && event.total > 0
					? Math.max(0, Math.min(1, event.loaded / event.total))
					: null,
			);
		};
		request.onload = () => {
			signal?.removeEventListener("abort", abort);
			if (request.status < 200 || request.status >= 300) {
				reject(new Error("ocr-job-create-failed"));
				return;
			}
			try {
				resolve(readResponseJob(request.responseText));
			} catch (error) {
				reject(error);
			}
		};
		request.onerror = () => {
			signal?.removeEventListener("abort", abort);
			reject(new Error("ocr-job-create-failed"));
		};
		request.onabort = () => {
			signal?.removeEventListener("abort", abort);
			reject(
				signal?.reason ??
					new DOMException("Label scan cancelled", "AbortError"),
			);
		};
		signal?.addEventListener("abort", abort, { once: true });
		const body = new FormData();
		body.set("photo", file);
		request.send(body);
	});
};

export const readNutritionLabelOcrJob = async (
	jobId: string,
	signal?: AbortSignal,
) => {
	const response = await fetch(`/api/nutrition-label-ocr/jobs/${jobId}`, {
		headers: { accept: "application/json" },
		signal,
	});
	if (!response.ok) throw new Error("ocr-job-status-failed");
	const body = (await response.json()) as NutritionLabelOcrJobResponse;
	return readJob(body.job);
};

export const cancelNutritionLabelOcrJob = async (
	jobId: string,
	signal?: AbortSignal,
) => {
	const response = await fetch(`/api/nutrition-label-ocr/jobs/${jobId}`, {
		method: "DELETE",
		signal,
	});
	if (!response.ok && response.status !== 404) {
		throw new Error("ocr-job-cancel-failed");
	}
};

const wait = (milliseconds: number, signal?: AbortSignal) =>
	new Promise<void>((resolve, reject) => {
		if (signal?.aborted) {
			reject(signal.reason ?? new DOMException("Cancelled", "AbortError"));
			return;
		}
		const finish = () => {
			signal?.removeEventListener("abort", abort);
			resolve();
		};
		const timeout = setTimeout(finish, milliseconds);
		const abort = () => {
			clearTimeout(timeout);
			signal?.removeEventListener("abort", abort);
			reject(signal?.reason ?? new DOMException("Cancelled", "AbortError"));
		};
		signal?.addEventListener("abort", abort, { once: true });
	});

export const waitForNutritionLabelOcrJob = async (
	initialJob: NutritionLabelOcrJob,
	signal?: AbortSignal,
	readJobStatus = readNutritionLabelOcrJob,
) => {
	let job = initialJob;
	let delay = NUTRITION_LABEL_OCR_JOB_POLL_INITIAL_MILLISECONDS;
	while (job.status === "queued" || job.status === "running") {
		await wait(delay, signal);
		job = await readJobStatus(job.id, signal);
		delay = Math.min(
			NUTRITION_LABEL_OCR_JOB_POLL_MAX_MILLISECONDS,
			Math.round(delay * 1.5),
		);
	}
	return job;
};

export const runNutritionLabelOcrJob = async ({
	file,
	onStatus,
	onJobId,
	onUploadProgress,
	signal,
}: {
	file: File;
	onStatus?: (status: NutritionLabelOcrJob["status"]) => void;
	onJobId?: (jobId: string) => void;
	onUploadProgress?: (progress: number | null) => void;
	signal?: AbortSignal;
}) => {
	const created = await createNutritionLabelOcrJob({
		file,
		onUploadProgress,
		signal,
	});
	onJobId?.(created.id);
	onStatus?.(created.status);
	const completed = await waitForNutritionLabelOcrJob(
		created,
		signal,
		async (jobId, pollSignal) => {
			const job = await readNutritionLabelOcrJob(jobId, pollSignal);
			onStatus?.(job.status);
			return job;
		},
	);
	if (completed.status !== "completed" || !completed.result) {
		throw new Error(completed.errorCode ?? `ocr-job-${completed.status}`);
	}
	return { jobId: completed.id, result: completed.result };
};
