import type { FdcFood } from "$lib/utils/food/types";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";

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
	frontImageCrop?: {
		cropX: number;
		cropY: number;
		cropZoom: number;
	} | null;
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
		const body = await response.json().catch(() => null) as {
			message?: string;
		} | null;
		throw new Error(
			body?.message ??
				"The barcode could not be verified for sharing. You can still save it privately.",
		);
	}
	return await response.json() as BarcodeShareValidationResult;
};

export const searchSharedProducts = async (query: string): Promise<FdcFood[]> => {
	const trimmed = query.trim();
	if (trimmed.length < 2) return [];

	const response = await fetch(
		`/api/products/search?q=${encodeURIComponent(trimmed)}`,
		{ headers: { accept: "application/json" } },
	);
	if (!response.ok) return [];
	const data = await response.json() as { foods?: FdcFood[] };
	return data.foods ?? [];
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
		const body = await response.json().catch(() => null) as { message?: string } | null;
		throw new Error(
			body?.message ?? "The product could not be submitted for catalog review.",
		);
	}

	return await response.json() as SharedProductSubmissionResult;
};
