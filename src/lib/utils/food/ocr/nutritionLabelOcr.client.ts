import type {
	NutritionLabelOcrProgress,
	NutritionLabelOcrRecognition,
} from "$lib/utils/food/ocr/nutritionLabelOcr";

export const recognizeNutritionLabelImage = async ({
	file,
	onProgress,
	signal,
}: {
	file: File;
	onProgress?: (progress: NutritionLabelOcrProgress) => void;
	signal?: AbortSignal;
}): Promise<NutritionLabelOcrRecognition> => {
	const { createWorker } = await import("tesseract.js");
	let terminated = false;
	const worker = await createWorker("eng", 1, {
		logger: (message) => {
			onProgress?.({
				status: message.status,
				progress: Math.max(0, Math.min(1, message.progress ?? 0)),
			});
		},
	});
	const terminate = async () => {
		if (terminated) return;
		terminated = true;
		await worker.terminate();
	};
	const abort = () => {
		void terminate();
	};
	signal?.addEventListener("abort", abort, { once: true });

	try {
		if (signal?.aborted) throw new DOMException("Label scan cancelled", "AbortError");
		const result = await worker.recognize(file);
		if (signal?.aborted) throw new DOMException("Label scan cancelled", "AbortError");
		return {
			text: result.data.text,
			confidence: result.data.confidence,
		};
	} finally {
		signal?.removeEventListener("abort", abort);
		await terminate();
	}
};
