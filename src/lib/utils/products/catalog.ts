import type { FoodItem } from "$lib/utils/food/types";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { ImagePlacementValue } from "$lib/utils/food/images/types";
import {
	createUserFacingErrorFromResponse,
	readAppIssuePayload,
} from "$lib/utils/errors/userFacingErrors";

export type SharedProductSubmissionStatus =
	"already-available" | "approved" | "pending" | "source-mismatch";

export type SharedProductSubmissionResult = {
	status: SharedProductSubmissionStatus;
	message: string;
	evidenceAccepted?: boolean;
};

export type CatalogSubmissionIntent = "catalog_share" | "catalog_correction";

export type SharedProductEvidence = {
	frontPhoto?: File | null;
	nutritionPhoto?: File | null;
	barcodePhoto?: File | null;
	frontImageCrop?: ImagePlacementValue | null;
};

export type SharedProductSubmissionContext = {
	consentToShare: true;
	reviewFlags?: string[];
	intent?: CatalogSubmissionIntent;
};

export type BarcodeShareValidationResult =
	| {
			status: "matched";
			barcode: string;
			draft: BarcodeProductDraft;
			defaultSharingAllowed: boolean;
	  }
	| {
			status: "name-mismatch";
			barcode: string;
			draft: BarcodeProductDraft;
			defaultSharingAllowed?: false;
			message?: string;
	  }
	| {
			status: "not-found";
			barcode: string;
			defaultSharingAllowed?: false;
	  };

export const validateBarcodeProductForSharing = async (
	barcode: string,
	productName: string,
): Promise<BarcodeShareValidationResult> => {
	const response = await fetch(
		`/api/products/barcode/${encodeURIComponent(barcode)}/share-validation`,
		{
			method: "POST",
			headers: {
				accept: "application/json",
				"content-type": "application/json",
			},
			body: JSON.stringify({ productName }),
		},
	);
	if (!response.ok) {
		throw await createUserFacingErrorFromResponse(
			response,
			"CATALOG_VALIDATION_UNAVAILABLE",
		);
	}
	const result = (await response.json()) as BarcodeShareValidationResult & {
		issue?: unknown;
	};
	if (result.status !== "name-mismatch") return result;

	const issue = readAppIssuePayload(result.issue);
	return {
		status: result.status,
		barcode: result.barcode,
		draft: result.draft,
		message: issue?.message,
	};
};

export const submitSharedProduct = async (
	food: FoodItem,
	evidence: SharedProductEvidence = {},
	context: SharedProductSubmissionContext,
): Promise<SharedProductSubmissionResult> => {
	const formData = new FormData();
	formData.set("food", JSON.stringify(food));
	formData.set("consentToShare", String(context.consentToShare));
	if (context.reviewFlags?.length) {
		formData.set("reviewFlags", JSON.stringify(context.reviewFlags));
	}
	formData.set("submissionIntent", context.intent ?? "catalog_share");
	if (evidence.frontPhoto) formData.set("frontPhoto", evidence.frontPhoto);
	if (evidence.frontImageCrop) {
		formData.set("frontImageCrop", JSON.stringify(evidence.frontImageCrop));
	}
	if (evidence.nutritionPhoto) {
		formData.set("nutritionPhoto", evidence.nutritionPhoto);
	}
	if (evidence.barcodePhoto)
		formData.set("barcodePhoto", evidence.barcodePhoto);

	const response = await fetch("/api/products/submissions", {
		method: "POST",
		headers: { accept: "application/json" },
		body: formData,
	});

	if (!response.ok) {
		throw await createUserFacingErrorFromResponse(
			response,
			"CATALOG_SUBMISSION_FAILED",
		);
	}

	return (await response.json()) as SharedProductSubmissionResult;
};
