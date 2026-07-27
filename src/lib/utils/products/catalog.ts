import type { FdcFood } from "$lib/utils/food/types";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { ImagePlacementValue } from "$lib/utils/food/images/types";
import {
	createUserFacingErrorFromResponse,
	readAppIssuePayload,
} from "$lib/utils/errors/userFacingErrors";

export type SharedProductSubmissionStatus =
	| "already-available"
	| "approved"
	| "pending"
	| "source-mismatch";

export type SharedProductSubmissionResult = {
	status: SharedProductSubmissionStatus;
	message: string;
	evidenceAccepted?: boolean;
};

export type SharedProductEvidence = {
	frontPhoto?: File | null;
	nutritionPhoto?: File | null;
	barcodePhoto?: File | null;
	frontImageCrop?: ImagePlacementValue | null;
};

export type SharedProductSubmissionContext = {
	reviewFlags?: string[];
};

export type BarcodeShareValidationResult =
	| {
			status: "matched" | "name-mismatch";
			barcode: string;
			draft: BarcodeProductDraft;
			message?: string;
	  }
	| {
			status: "not-found";
			barcode: string;
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
	const result = await response.json() as BarcodeShareValidationResult & {
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
	food: FdcFood,
	evidence: SharedProductEvidence = {},
	context: SharedProductSubmissionContext = {},
): Promise<SharedProductSubmissionResult> => {
	const formData = new FormData();
	formData.set("food", JSON.stringify(food));
	formData.set("consentToShare", "true");
	if (context.reviewFlags?.length) {
		formData.set("reviewFlags", JSON.stringify(context.reviewFlags));
	}
	if (evidence.frontPhoto) formData.set("frontPhoto", evidence.frontPhoto);
	if (evidence.frontImageCrop) {
		formData.set("frontImageCrop", JSON.stringify(evidence.frontImageCrop));
	}
	if (evidence.nutritionPhoto) {
		formData.set("nutritionPhoto", evidence.nutritionPhoto);
	}
	if (evidence.barcodePhoto) formData.set("barcodePhoto", evidence.barcodePhoto);

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

	return await response.json() as SharedProductSubmissionResult;
};
