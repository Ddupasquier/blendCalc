import type {
	ImagePlacementGeometry,
	SmartImagePlacementDocument,
	SmartImagePlacementProgress,
	SmartImagePlacementSuggestion,
} from "$lib/utils/food/images/types";
import { UserFacingError } from "$lib/utils/errors/userFacingErrors";
import { selectBestImagePlacementSuggestion } from "./smartImagePlacement";

const MAX_URL_CACHE_ENTRIES = 12;
const MAX_OCR_IMAGE_DIMENSION = 1800;
const MIN_OCR_IMAGE_DIMENSION = 1200;
const QUARTER_TURN_RECOGNITION_ATTEMPTS = [
	0 as const,
	90 as const,
	270 as const,
	180 as const,
];
const TOTAL_RECOGNITION_ATTEMPTS =
	QUARTER_TURN_RECOGNITION_ATTEMPTS.length + 1;
const blobRecognitionCache = new WeakMap<
	Blob,
	Promise<SmartImagePlacementDocument[]>
>();
const urlRecognitionCache = new Map<
	string,
	Promise<SmartImagePlacementDocument[]>
>();

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
		throw new UserFacingError(
			"We couldn't open this photo. Try another image or adjust it by hand.",
			error,
		);
	}
};

const loadRemoteImage = async (url: string) => {
	let response: Response;
	try {
		response = await fetch(url, { credentials: "omit", mode: "cors" });
	} catch (error) {
		throw new UserFacingError(
			"We couldn't load this photo for automatic placement. Check your connection or adjust it by hand.",
			error,
		);
	}
	if (!response.ok) {
		throw new UserFacingError(
			"We couldn't load this photo for automatic placement. You can still adjust it by hand.",
		);
	}
	return response.blob();
};

const prepareImage = async (image: Blob | string) => {
	const blob = typeof image === "string"
		? await loadRemoteImage(image)
		: image;
	const bitmap = await loadBitmap(blob);
	const largestDimension = Math.max(bitmap.width, bitmap.height);
	const scale = Math.min(
		MAX_OCR_IMAGE_DIMENSION / largestDimension,
		Math.max(1, MIN_OCR_IMAGE_DIMENSION / largestDimension),
	);
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(bitmap.width * scale));
	canvas.height = Math.max(1, Math.round(bitmap.height * scale));
	const context = canvas.getContext("2d");
	if (!context) {
		bitmap.dispose();
		throw new UserFacingError(
			"We couldn't prepare this photo for automatic placement. You can still adjust it by hand.",
		);
	}
	context.drawImage(bitmap.source, 0, 0, canvas.width, canvas.height);
	bitmap.dispose();
	return canvas;
};

const rotateImageCanvas = (
	source: HTMLCanvasElement,
	rotationDegrees: 0 | 90 | 180 | 270,
) => {
	if (rotationDegrees === 0) return source;
	const swapsDimensions = rotationDegrees === 90 || rotationDegrees === 270;
	const canvas = document.createElement("canvas");
	canvas.width = swapsDimensions ? source.height : source.width;
	canvas.height = swapsDimensions ? source.width : source.height;
	const context = canvas.getContext("2d");
	if (!context) {
		throw new UserFacingError(
			"We couldn't prepare this photo for automatic placement. You can still adjust it by hand.",
		);
	}
	context.translate(canvas.width / 2, canvas.height / 2);
	context.rotate((rotationDegrees * Math.PI) / 180);
	context.drawImage(source, -source.width / 2, -source.height / 2);
	return canvas;
};

const recognizeImage = async (
	image: Blob | string,
	onProgress?: (progress: SmartImagePlacementProgress) => void,
): Promise<SmartImagePlacementDocument[]> => {
	const canvas = await prepareImage(image);
	const { createWorker, PSM } = await import("tesseract.js");
	let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
	let recognitionAttemptIndex = -1;

	try {
		worker = await createWorker("eng", 1, {
			logger: (message) => {
				const initializationProgress = Math.max(
					0,
					Math.min(1, message.progress ?? 0),
				);
				const progress = recognitionAttemptIndex < 0
					? initializationProgress * 0.15
					: 0.15 +
						((recognitionAttemptIndex + initializationProgress) /
							TOTAL_RECOGNITION_ATTEMPTS) *
							0.85;
				onProgress?.({
					status: message.status,
					progress: Math.max(0, Math.min(1, progress)),
				});
			},
		});
		await worker.setParameters({
			tessedit_pageseg_mode: PSM.SPARSE_TEXT,
			preserve_interword_spaces: "1",
		});
		const documents: SmartImagePlacementDocument[] = [];
		for (const [attemptIndex, rotationDegrees] of QUARTER_TURN_RECOGNITION_ATTEMPTS.entries()) {
			recognitionAttemptIndex = attemptIndex;
			const orientedCanvas = rotateImageCanvas(canvas, rotationDegrees);
			const result = await worker.recognize(
				orientedCanvas,
				{ rotateAuto: true },
				{ blocks: true, text: true },
			);
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
						}))
					)
				) ?? [];
			documents.push({
				width: orientedCanvas.width,
				height: orientedCanvas.height,
				rotationDegrees,
				regions,
			});
		}
		await worker.setParameters({
			tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
			preserve_interword_spaces: "1",
		});
		recognitionAttemptIndex = QUARTER_TURN_RECOGNITION_ATTEMPTS.length;
		const fallbackResult = await worker.recognize(
			canvas,
			{ rotateAuto: true },
			{ blocks: true, text: true },
		);
		const fallbackRegions =
			fallbackResult.data.blocks?.flatMap((block) =>
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
		documents.push({
			width: canvas.width,
			height: canvas.height,
			rotationDegrees: 0,
			regions: fallbackRegions,
		});
		return documents;
	} catch (error) {
		if (error instanceof UserFacingError) throw error;
		throw new UserFacingError(
			"We couldn't find the product name in this photo. You can still adjust it by hand or try again.",
			error,
		);
	} finally {
		await worker?.terminate();
	}
};

const rememberUrlRecognition = (
	url: string,
	promise: Promise<SmartImagePlacementDocument[]>,
) => {
	urlRecognitionCache.set(url, promise);
	while (urlRecognitionCache.size > MAX_URL_CACHE_ENTRIES) {
		const oldestKey = urlRecognitionCache.keys().next().value;
		if (typeof oldestKey !== "string") break;
		urlRecognitionCache.delete(oldestKey);
	}
};

const getRecognition = (
	image: Blob | string,
	onProgress?: (progress: SmartImagePlacementProgress) => void,
) => {
	if (typeof image !== "string") {
		const cached = blobRecognitionCache.get(image);
		if (cached) return cached;
		const recognition = recognizeImage(image, onProgress).catch((error) => {
			blobRecognitionCache.delete(image);
			throw error;
		});
		blobRecognitionCache.set(image, recognition);
		return recognition;
	}

	const cached = urlRecognitionCache.get(image);
	if (cached) {
		urlRecognitionCache.delete(image);
		urlRecognitionCache.set(image, cached);
		return cached;
	}
	const recognition = recognizeImage(image, onProgress).catch((error) => {
		urlRecognitionCache.delete(image);
		throw error;
	});
	rememberUrlRecognition(image, recognition);
	return recognition;
};

export const suggestImagePlacement = async ({
	image,
	geometry,
	productName,
	brandName,
	onProgress,
}: {
	image: Blob | string;
	geometry: ImagePlacementGeometry;
	productName: string;
	brandName?: string;
	onProgress?: (progress: SmartImagePlacementProgress) => void;
}): Promise<SmartImagePlacementSuggestion | null> => {
	const documents = await getRecognition(image, onProgress);
	onProgress?.({ status: "scoring product label text", progress: 1 });
	return selectBestImagePlacementSuggestion({
		documents,
		geometry,
		productName,
		brandName,
	});
};
