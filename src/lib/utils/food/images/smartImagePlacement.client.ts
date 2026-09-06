import type {
	ImagePlacementGeometry,
	SmartImagePlacementDocument,
	SmartImagePlacementProgress,
	SmartImagePlacementSuggestion,
} from "$lib/utils/food/images/types";
import { selectBestImagePlacementSuggestion } from "./smartImagePlacement";
import { SmartImagePlacementError } from "./smartImagePlacementDiagnostics";
import {
	OcrWorkerCoordinatorError,
	runCoordinatedOcrRecognition,
} from "$lib/utils/food/ocr/ocrWorkerCoordinator.client";

const MAX_URL_CACHE_ENTRIES = 12;
export const MAX_SMART_PLACEMENT_IMAGE_DIMENSION = 768;
export const SMART_PLACEMENT_TIMEOUT_MILLISECONDS = 10_000;
const blobRecognitionCache = new WeakMap<Blob, SmartImagePlacementDocument[]>();
const urlRecognitionCache = new Map<string, SmartImagePlacementDocument[]>();

const throwIfAborted = (signal?: AbortSignal) => {
	if (!signal?.aborted) return;
	throw (
		signal.reason ??
		new DOMException("Automatic placement cancelled", "AbortError")
	);
};

const raceWithAbort = <Result>(
	promise: Promise<Result>,
	signal?: AbortSignal,
): Promise<Result> => {
	if (!signal) return promise;
	throwIfAborted(signal);
	return new Promise<Result>((resolve, reject) => {
		const abort = () => {
			reject(
				signal.reason ??
					new DOMException("Automatic placement cancelled", "AbortError"),
			);
		};
		signal.addEventListener("abort", abort, { once: true });
		void promise.then(resolve, reject).then(
			() => signal.removeEventListener("abort", abort),
			() => signal.removeEventListener("abort", abort),
		);
	});
};

const loadBitmap = async (blob: Blob) => {
	try {
		if (typeof createImageBitmap === "function") {
			const bitmap = await createImageBitmap(blob, {
				imageOrientation: "from-image",
			});
			return {
				source: bitmap,
				width: bitmap.width,
				height: bitmap.height,
				dispose: () => bitmap.close(),
			};
		}

		const objectUrl = URL.createObjectURL(blob);
		const image = new Image();
		image.src = objectUrl;
		try {
			await image.decode();
			return {
				source: image,
				width: image.naturalWidth,
				height: image.naturalHeight,
				dispose: () => URL.revokeObjectURL(objectUrl),
			};
		} catch (error) {
			URL.revokeObjectURL(objectUrl);
			throw error;
		}
	} catch (error) {
		throw new SmartImagePlacementError({
			message:
				"We couldn't open this photo. Try another image or adjust it by hand.",
			phase: "image-load",
			reasonCode: "photo-unreadable",
			cause: error,
		});
	}
};

const loadRemoteImage = async (url: string) => {
	let response: Response;
	try {
		response = await fetch(url, { credentials: "omit", mode: "cors" });
	} catch (error) {
		throw new SmartImagePlacementError({
			message:
				"We couldn't load this photo for automatic placement. Check your connection or adjust it by hand.",
			phase: "image-load",
			reasonCode: "photo-unavailable",
			cause: error,
		});
	}
	if (!response.ok) {
		throw new SmartImagePlacementError({
			message:
				"We couldn't load this photo for automatic placement. You can still adjust it by hand.",
			phase: "image-load",
			reasonCode: "photo-unavailable",
		});
	}
	return response.blob();
};

const prepareImage = async (image: Blob | string, signal?: AbortSignal) => {
	throwIfAborted(signal);
	const blob = typeof image === "string" ? await loadRemoteImage(image) : image;
	throwIfAborted(signal);
	const bitmapPromise = loadBitmap(blob);
	void bitmapPromise.then(
		(bitmap) => {
			if (signal?.aborted) bitmap.dispose();
		},
		() => undefined,
	);
	const bitmap = await raceWithAbort(bitmapPromise, signal);
	try {
		throwIfAborted(signal);
		const largestDimension = Math.max(bitmap.width, bitmap.height);
		const scale = Math.min(
			1,
			MAX_SMART_PLACEMENT_IMAGE_DIMENSION / largestDimension,
		);
		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, Math.round(bitmap.width * scale));
		canvas.height = Math.max(1, Math.round(bitmap.height * scale));
		const context = canvas.getContext("2d");
		if (!context) {
			throw new SmartImagePlacementError({
				message:
					"We couldn't prepare this photo for automatic placement. You can still adjust it by hand.",
				phase: "image-prepare",
				reasonCode: "canvas-unavailable",
			});
		}
		context.drawImage(bitmap.source, 0, 0, canvas.width, canvas.height);
		return canvas;
	} finally {
		bitmap.dispose();
	}
};

const recognizeImage = async (
	image: Blob | string,
	onProgress?: (progress: SmartImagePlacementProgress) => void,
	signal?: AbortSignal,
): Promise<SmartImagePlacementDocument[]> => {
	const canvas = await prepareImage(image, signal);
	throwIfAborted(signal);

	try {
		const result = await runCoordinatedOcrRecognition({
			image: canvas,
			parameters: {
				debug_file: "/dev/null",
				tessedit_pageseg_mode: "11",
				preserve_interword_spaces: "1",
			},
			recognizeOptions: {},
			output: { blocks: true, text: true },
			onProgress,
			signal,
			timeoutMilliseconds: SMART_PLACEMENT_TIMEOUT_MILLISECONDS,
		});
		throwIfAborted(signal);
		const regions =
			result.data.blocks?.flatMap((block) =>
				block.paragraphs.flatMap((paragraph) =>
					paragraph.lines.map((line) => ({
						text: line.text,
						confidence: line.confidence,
						bounds: {
							x0: line.bbox.x0,
							y0: line.bbox.y0,
							x1: line.bbox.x1,
							y1: line.bbox.y1,
						},
					})),
				),
			) ?? [];
		return [
			{
				width: canvas.width,
				height: canvas.height,
				rotationDegrees: 0,
				regions,
			},
		];
	} catch (error) {
		if (signal?.aborted) throwIfAborted(signal);
		if (error instanceof SmartImagePlacementError) throw error;
		const coordinatorPhase =
			error instanceof OcrWorkerCoordinatorError ? error.phase : "recognition";
		throw new SmartImagePlacementError({
			message:
				"We couldn't find the product name in this photo. You can still adjust it by hand or try again.",
			phase: coordinatorPhase,
			reasonCode:
				coordinatorPhase === "worker-load"
					? "ocr-unavailable"
					: coordinatorPhase === "worker-configure"
						? "ocr-configuration-failed"
						: "ocr-recognition-failed",
			cause: error,
		});
	}
};

const rememberUrlRecognition = (
	url: string,
	documents: SmartImagePlacementDocument[],
) => {
	urlRecognitionCache.set(url, documents);
	while (urlRecognitionCache.size > MAX_URL_CACHE_ENTRIES) {
		const oldestKey = urlRecognitionCache.keys().next().value;
		if (typeof oldestKey !== "string") break;
		urlRecognitionCache.delete(oldestKey);
	}
};

const getRecognition = (
	image: Blob | string,
	onProgress?: (progress: SmartImagePlacementProgress) => void,
	signal?: AbortSignal,
) => {
	if (typeof image !== "string") {
		const cached = blobRecognitionCache.get(image);
		if (cached) return Promise.resolve(cached);
		return recognizeImage(image, onProgress, signal).then((documents) => {
			blobRecognitionCache.set(image, documents);
			return documents;
		});
	}

	const cached = urlRecognitionCache.get(image);
	if (cached) {
		urlRecognitionCache.delete(image);
		urlRecognitionCache.set(image, cached);
		return Promise.resolve(cached);
	}
	return recognizeImage(image, onProgress, signal).then((documents) => {
		rememberUrlRecognition(image, documents);
		return documents;
	});
};

export const suggestImagePlacement = async ({
	image,
	geometry,
	productName,
	brandName,
	onProgress,
	signal,
	timeoutMilliseconds = SMART_PLACEMENT_TIMEOUT_MILLISECONDS,
}: {
	image: Blob | string;
	geometry: ImagePlacementGeometry;
	productName: string;
	brandName?: string;
	onProgress?: (progress: SmartImagePlacementProgress) => void;
	signal?: AbortSignal;
	timeoutMilliseconds?: number;
}): Promise<SmartImagePlacementSuggestion | null> => {
	const timeoutController = new AbortController();
	const timeout = window.setTimeout(
		() =>
			timeoutController.abort(
				new DOMException("Automatic placement timed out", "TimeoutError"),
			),
		Math.max(1, timeoutMilliseconds),
	);
	const forwardAbort = () =>
		timeoutController.abort(
			signal?.reason ??
				new DOMException("Automatic placement cancelled", "AbortError"),
		);
	signal?.addEventListener("abort", forwardAbort, { once: true });
	if (signal?.aborted) forwardAbort();

	try {
		const documents = await getRecognition(
			image,
			onProgress,
			timeoutController.signal,
		);
		throwIfAborted(timeoutController.signal);
		onProgress?.({ status: "scoring product label text", progress: 1 });
		return selectBestImagePlacementSuggestion({
			documents,
			geometry,
			productName,
			brandName,
		});
	} finally {
		window.clearTimeout(timeout);
		signal?.removeEventListener("abort", forwardAbort);
	}
};
