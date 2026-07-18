import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type {
	ManualEntryStepId,
	StepValidationItem,
} from "$lib/components/ingredients/manual-entry/formTypes";

export type ManualEntrySubmitBlock = {
	message: string;
	step: ManualEntryStepId;
};

export const getManualEntrySubmitState = ({
	loadingNutrientRelationshipRules,
	blockingValidation,
	useVolumeEquivalent,
	volumeQuantity,
	volumeAmountRequiredMessage,
	barcode,
	requiresCatalogEvidence,
	hasTrustedProductImage,
	frontPhoto,
	nutritionPhoto,
	barcodePhoto,
}: {
	loadingNutrientRelationshipRules: boolean;
	blockingValidation: StepValidationItem | null;
	useVolumeEquivalent: boolean;
	volumeQuantity: number | null;
	volumeAmountRequiredMessage: string;
	barcode: string;
	requiresCatalogEvidence: boolean;
	hasTrustedProductImage: boolean;
	frontPhoto: File | null;
	nutritionPhoto: File | null;
	barcodePhoto: File | null;
}): {
	block: ManualEntrySubmitBlock | null;
	normalizedBarcode: string | null;
} => {
	const normalizedBarcode = barcode.trim() ? normalizeBarcode(barcode) : null;

	if (loadingNutrientRelationshipRules) {
		return {
			normalizedBarcode,
			block: {
				message: "Nutrition validation rules are still loading. Try again in a moment.",
				step: "macros",
			},
		};
	}

	if (blockingValidation) {
		return {
			normalizedBarcode,
			block: {
				message: blockingValidation.message,
				step: blockingValidation.step,
			},
		};
	}

	if (
		useVolumeEquivalent &&
		(volumeQuantity === null || volumeQuantity <= 0)
	) {
		return {
			normalizedBarcode,
			block: {
				message: volumeAmountRequiredMessage,
				step: "servings",
			},
		};
	}

	if (barcode.trim() && !normalizedBarcode) {
		return {
			normalizedBarcode,
			block: {
				message: "Enter a valid 8, 12, 13, or 14 digit UPC/EAN barcode.",
				step: "identity",
			},
		};
	}

	if (
		requiresCatalogEvidence &&
		((!hasTrustedProductImage && !frontPhoto) || !nutritionPhoto || !barcodePhoto)
	) {
		return {
			normalizedBarcode,
			block: {
				message: hasTrustedProductImage
					? "Add nutrition label and barcode photos before sharing this product."
					: "Add front package, nutrition label, and barcode photos before sharing this product.",
				step: "share",
			},
		};
	}

	return { block: null, normalizedBarcode };
};
