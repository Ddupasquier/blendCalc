import type {
	ImageLike,
	OutputFormats,
	RecognizeOptions,
	RecognizeResult,
	Worker,
} from "tesseract.js";

export const OCR_WORKER_IDLE_TIMEOUT_MILLISECONDS = 5_000;

type OcrWorkerProgress = { status: string; progress: number };

export class OcrWorkerCoordinatorError extends Error {
	constructor(
		readonly phase: "worker-load" | "worker-configure" | "recognition",
		options?: ErrorOptions,
	) {
		super(`OCR ${phase} failed`, options);
		this.name = "OcrWorkerCoordinatorError";
	}
}

type CoordinatedRecognitionOptions = {
	image: ImageLike;
	parameters: Record<string, string>;
	recognizeOptions?: Partial<RecognizeOptions>;
	output?: Partial<OutputFormats>;
	onProgress?: (progress: OcrWorkerProgress) => void;
	signal?: AbortSignal;
	timeoutMilliseconds: number;
};

let worker: Worker | null = null;
let workerPromise: Promise<Worker> | null = null;
let queue: Promise<void> = Promise.resolve();
let activeProgress: ((progress: OcrWorkerProgress) => void) | undefined;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

const abortError = (message: string, signal?: AbortSignal) =>
	signal?.reason ?? new DOMException(message, "AbortError");

const clearIdleTimer = () => {
	if (!idleTimer) return;
	clearTimeout(idleTimer);
	idleTimer = null;
};

const terminateWorker = async () => {
	clearIdleTimer();
	const currentWorker = worker;
	const pendingWorker = workerPromise;
	worker = null;
	workerPromise = null;
	activeProgress = undefined;
	if (currentWorker) {
		await currentWorker.terminate().catch(() => undefined);
		return;
	}
	if (pendingWorker) {
		const createdWorker = await pendingWorker.catch(() => null);
		await createdWorker?.terminate().catch(() => undefined);
	}
};

const scheduleIdleTermination = () => {
	clearIdleTimer();
	idleTimer = setTimeout(() => {
		void terminateWorker();
	}, OCR_WORKER_IDLE_TIMEOUT_MILLISECONDS);
};

const getWorker = async () => {
	clearIdleTimer();
	if (worker) return worker;
	if (!workerPromise) {
		workerPromise = import("tesseract.js")
			.then(({ createWorker }) =>
				createWorker("eng", 1, {
					errorHandler: () => undefined,
					logger: (message) => {
						activeProgress?.({
							status: message.status,
							progress: Math.max(0, Math.min(1, message.progress ?? 0)),
						});
					},
				}),
			)
			.then((createdWorker) => {
				worker = createdWorker;
				return createdWorker;
			})
			.catch((error) => {
				throw new OcrWorkerCoordinatorError("worker-load", { cause: error });
			});
	}
	return workerPromise;
};

const raceRecognition = async (
	promise: Promise<RecognizeResult>,
	{
		signal,
		timeoutMilliseconds,
	}: Pick<CoordinatedRecognitionOptions, "signal" | "timeoutMilliseconds">,
) => {
	if (signal?.aborted) throw abortError("Recognition cancelled", signal);
	let timeout: ReturnType<typeof setTimeout> | null = null;
	let abort: (() => void) | null = null;
	try {
		return await Promise.race([
			promise,
			new Promise<never>((_, reject) => {
				timeout = setTimeout(() => {
					reject(new DOMException("Recognition timed out", "TimeoutError"));
				}, timeoutMilliseconds);
				if (signal) {
					abort = () => reject(abortError("Recognition cancelled", signal));
					signal.addEventListener("abort", abort, { once: true });
				}
			}),
		]);
	} finally {
		if (timeout) clearTimeout(timeout);
		if (signal && abort) signal.removeEventListener("abort", abort);
	}
};

const executeRecognition = async (
	options: CoordinatedRecognitionOptions,
): Promise<RecognizeResult> => {
	if (options.signal?.aborted)
		throw abortError("Recognition cancelled", options.signal);
	let completed = false;
	try {
		const activeWorker = await getWorker();
		if (options.signal?.aborted)
			throw abortError("Recognition cancelled", options.signal);
		activeProgress = options.onProgress;
		try {
			await activeWorker.setParameters(options.parameters);
		} catch (error) {
			throw new OcrWorkerCoordinatorError("worker-configure", {
				cause: error,
			});
		}
		let result: RecognizeResult;
		try {
			const recognition = activeWorker.recognize(
				options.image,
				options.recognizeOptions,
				options.output,
			);
			result = await raceRecognition(recognition, options);
		} catch (error) {
			if (error instanceof DOMException) throw error;
			throw new OcrWorkerCoordinatorError("recognition", { cause: error });
		}
		completed = true;
		return result;
	} finally {
		activeProgress = undefined;
		if (completed) scheduleIdleTermination();
		else await terminateWorker();
	}
};

export const runCoordinatedOcrRecognition = (
	options: CoordinatedRecognitionOptions,
): Promise<RecognizeResult> => {
	const result = queue.then(
		() => executeRecognition(options),
		() => executeRecognition(options),
	);
	queue = result.then(
		() => undefined,
		() => undefined,
	);
	return result;
};

export const disposeOcrWorkerCoordinator = async () => {
	await queue;
	await terminateWorker();
};
