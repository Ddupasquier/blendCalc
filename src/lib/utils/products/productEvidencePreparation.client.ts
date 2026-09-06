import { prepareSelectedImageUpload } from "$lib/utils/food/images/selectedImagePreview.client";
import type {
	SharedProductEvidence,
	SharedProductEvidenceRole,
	SharedProductSubmissionProgress,
} from "$lib/utils/products/catalog";
import { UserFacingError } from "$lib/utils/errors/userFacingErrors";

export const MAX_PRODUCT_EVIDENCE_SOURCE_BYTES = 20 * 1024 * 1024;

const preparationLimits: Record<
	SharedProductEvidenceRole,
	{ maxDimension: number; maxBytes: number }
> = {
	front: { maxDimension: 3072, maxBytes: 800 * 1024 },
	nutrition: { maxDimension: 4096, maxBytes: 1400 * 1024 },
	barcode: { maxDimension: 2048, maxBytes: 550 * 1024 },
};

const evidenceEntries = (evidence: SharedProductEvidence) =>
	(
		[
			["front", evidence.frontPhoto],
			["nutrition", evidence.nutritionPhoto],
			["barcode", evidence.barcodePhoto],
		] as const
	).filter((entry): entry is readonly [SharedProductEvidenceRole, File] =>
		Boolean(entry[1]),
	);

export const prepareSharedProductEvidence = async (
	evidence: SharedProductEvidence,
	onProgress?: (progress: SharedProductSubmissionProgress) => void,
): Promise<SharedProductEvidence> => {
	const entries = evidenceEntries(evidence);
	const prepared: SharedProductEvidence = {
		frontImageCrop: evidence.frontImageCrop,
	};

	for (const [index, [role, file]] of entries.entries()) {
		if (file.size > MAX_PRODUCT_EVIDENCE_SOURCE_BYTES) {
			throw new UserFacingError(
				`The ${role} photo is larger than the supported 20 MB source limit.`,
			);
		}
		onProgress?.({
			phase: "preparing",
			role,
			completed: index,
			total: entries.length,
		});
		let nextFile: File;
		try {
			nextFile = await prepareSelectedImageUpload(
				file,
				preparationLimits[role],
			);
		} catch (cause) {
			throw new UserFacingError(
				`The ${role} photo could not be prepared safely. Choose a smaller JPEG, PNG, or WebP photo and try again.`,
				cause,
			);
		}
		if (role === "front") prepared.frontPhoto = nextFile;
		if (role === "nutrition") prepared.nutritionPhoto = nextFile;
		if (role === "barcode") prepared.barcodePhoto = nextFile;
		onProgress?.({
			phase: "prepared",
			role,
			completed: index + 1,
			total: entries.length,
		});
	}

	return prepared;
};
