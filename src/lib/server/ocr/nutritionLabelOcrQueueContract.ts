export const NUTRITION_LABEL_OCR_QUEUE_TOPIC = "nutrition-label-ocr";

export type NutritionLabelOcrQueueMessage = {
	jobId: string;
};

export const isNutritionLabelOcrQueueMessage = (
	message: unknown,
): message is NutritionLabelOcrQueueMessage =>
	Boolean(
		message &&
		typeof message === "object" &&
		"jobId" in message &&
		typeof message.jobId === "string" &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
			message.jobId,
		),
	);
