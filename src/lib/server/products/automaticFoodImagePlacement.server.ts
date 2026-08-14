import sharp from "sharp";
import { createWorker, PSM, type Worker } from "tesseract.js";
import {
	createFullImagePlacement,
	getImagePlacementGeometry,
} from "$lib/utils/food/images/imagePlacement";
import {
	isConfidentAutomaticImagePlacementSuggestion,
	selectBestImagePlacementSuggestion,
} from "$lib/utils/food/images/smartImagePlacement";
import type {
	ImagePlacementValue,
	ImageRotationDegrees,
	SmartImagePlacementDocument,
} from "$lib/utils/food/images/types";

const OCR_TARGET_IMAGE_DIMENSION = 1600;
const REPRESENTATIVE_CARD_MEDIA_LANE_WIDTH = 96;
const REPRESENTATIVE_CARD_HEIGHT = 68;
const QUARTER_TURN_RECOGNITION_ATTEMPTS: ImageRotationDegrees[] = [
	0,
	90,
	270,
	180,
];

const recognizeQuarterTurns = async ({
	worker,
	imageBuffer,
	pageSegmentationMode,
	rotationDegreesToCheck = QUARTER_TURN_RECOGNITION_ATTEMPTS,
}: {
	worker: Worker;
	imageBuffer: Buffer;
	pageSegmentationMode: PSM;
	rotationDegreesToCheck?: ImageRotationDegrees[];
}) => {
	await worker.setParameters({
		tessedit_pageseg_mode: pageSegmentationMode,
		preserve_interword_spaces: "1",
	});
	const documents: SmartImagePlacementDocument[] = [];

	for (const rotationDegrees of rotationDegreesToCheck) {
		const { data: orientedImageBuffer, info } = await sharp(imageBuffer)
			.rotate(rotationDegrees)
			.png()
			.toBuffer({ resolveWithObject: true });
		const result = await worker.recognize(
			orientedImageBuffer,
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
					})),
				),
			) ?? [];
		documents.push({
			width: info.width,
			height: info.height,
			rotationDegrees,
			regions,
		});
	}

	return documents;
};

export const suggestAutomaticFoodImagePlacement = async ({
	imageBytes,
	productName,
	brandName = "",
}: {
	imageBytes: Uint8Array;
	productName: string;
	brandName?: string;
}): Promise<ImagePlacementValue | null> => {
	const { data: preparedImageBuffer, info } = await sharp(imageBytes, {
		failOn: "warning",
	})
		.autoOrient()
		.resize({
			width: OCR_TARGET_IMAGE_DIMENSION,
			height: OCR_TARGET_IMAGE_DIMENSION,
			fit: "inside",
			withoutEnlargement: false,
		})
		.sharpen()
		.png()
		.toBuffer({ resolveWithObject: true });
	const geometry = getImagePlacementGeometry({
		naturalWidth: info.width,
		naturalHeight: info.height,
		frameWidth: REPRESENTATIVE_CARD_MEDIA_LANE_WIDTH,
		frameHeight: REPRESENTATIVE_CARD_HEIGHT,
		horizontalMovement: "left-only",
		value: createFullImagePlacement(),
	});
	const worker = await createWorker("eng");

	try {
		for (const pageSegmentationMode of [PSM.SPARSE_TEXT, PSM.SINGLE_BLOCK]) {
			const documents = await recognizeQuarterTurns({
				worker,
				imageBuffer: preparedImageBuffer,
				pageSegmentationMode,
				rotationDegreesToCheck:
					pageSegmentationMode === PSM.SINGLE_BLOCK
						? [0]
						: QUARTER_TURN_RECOGNITION_ATTEMPTS,
			});
			const suggestion = selectBestImagePlacementSuggestion({
				documents,
				geometry,
				productName,
				brandName,
			});
			if (!isConfidentAutomaticImagePlacementSuggestion(suggestion)) continue;
			return {
				...suggestion.placement,
				placementMethod: "automatic-ocr",
			};
		}

		return null;
	} finally {
		await worker.terminate();
	}
};
