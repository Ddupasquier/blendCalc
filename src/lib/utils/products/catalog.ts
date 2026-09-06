import type { FoodItem } from "$lib/utils/food/types";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { ImagePlacementValue } from "$lib/utils/food/images/types";
import {
	createUserFacingErrorFromResponse,
	readAppIssuePayload,
	UserFacingError,
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

export type SharedProductEvidenceRole = "front" | "nutrition" | "barcode";

export type SharedProductSubmissionProgress =
	| {
			phase: "preparing" | "prepared";
			role: SharedProductEvidenceRole;
			completed: number;
			total: number;
	  }
	| { phase: "uploading"; loaded: number; total: number | null }
	| { phase: "uploaded" }
	| { phase: "failed" };

export type SharedProductSubmissionContext = {
	consentToShare: true;
	reviewFlags?: string[];
	intent?: CatalogSubmissionIntent;
	onProgress?: (progress: SharedProductSubmissionProgress) => void;
};

const MAX_CATALOG_INTAKE_REQUEST_BYTES = 4 * 1024 * 1024;

const estimateFormDataBytes = (formData: FormData) => {
	let bytes = 16 * 1024;
	for (const [name, value] of formData.entries()) {
		bytes += new TextEncoder().encode(name).byteLength + 512;
		bytes +=
			typeof value === "string"
				? new TextEncoder().encode(value).byteLength
				: value.size;
	}
	return bytes;
};

const submitFormData = (
	formData: FormData,
	onProgress?: (progress: SharedProductSubmissionProgress) => void,
) => {
	if (!onProgress || typeof XMLHttpRequest !== "function") {
		return fetch("/api/intake/v1/product-observations", {
			method: "POST",
			headers: { accept: "application/json" },
			body: formData,
		});
	}

	return new Promise<Response>((resolve, reject) => {
		const request = new XMLHttpRequest();
		request.open("POST", "/api/intake/v1/product-observations");
		request.setRequestHeader("accept", "application/json");
		request.upload.onprogress = (event) => {
			onProgress({
				phase: "uploading",
				loaded: event.loaded,
				total: event.lengthComputable ? event.total : null,
			});
		};
		request.onload = () => {
			resolve(
				new Response(request.responseText, {
					status: request.status,
					headers: {
						"content-type":
							request.getResponseHeader("content-type") ?? "application/json",
					},
				}),
			);
		};
		request.onerror = () => reject(new Error("The upload connection failed."));
		request.onabort = () =>
			reject(new DOMException("Upload cancelled", "AbortError"));
		onProgress({ phase: "uploading", loaded: 0, total: null });
		request.send(formData);
	});
};

export type BarcodeShareValidationResult =
	| {
			status: "matched";
			barcode: string;
			draft: BarcodeProductDraft;
			defaultSharingAllowed: boolean;
			requiresCatalogEvidence: boolean;
	  }
	| {
			status: "name-mismatch";
			barcode: string;
			draft: BarcodeProductDraft;
			defaultSharingAllowed?: false;
			requiresCatalogEvidence: boolean;
			message?: string;
	  }
	| {
			status: "not-found";
			barcode: string;
			defaultSharingAllowed?: false;
			requiresCatalogEvidence: true;
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
		requiresCatalogEvidence: result.requiresCatalogEvidence,
		message: issue?.message,
	};
};

export const submitSharedProduct = async (
	food: FoodItem,
	evidence: SharedProductEvidence = {},
	context: SharedProductSubmissionContext,
): Promise<SharedProductSubmissionResult> => {
	let preparedEvidence = evidence;
	try {
		if (
			evidence.frontPhoto ||
			evidence.nutritionPhoto ||
			evidence.barcodePhoto
		) {
			const { prepareSharedProductEvidence } =
				await import("$lib/utils/products/productEvidencePreparation.client");
			preparedEvidence = await prepareSharedProductEvidence(
				evidence,
				context.onProgress,
			);
		}
	} catch (error) {
		context.onProgress?.({ phase: "failed" });
		throw error;
	}
	const formData = new FormData();
	formData.set("food", JSON.stringify(food));
	formData.set("consentToShare", String(context.consentToShare));
	if (context.reviewFlags?.length) {
		formData.set("reviewFlags", JSON.stringify(context.reviewFlags));
	}
	formData.set("submissionIntent", context.intent ?? "catalog_share");
	if (preparedEvidence.frontPhoto)
		formData.set("frontPhoto", preparedEvidence.frontPhoto);
	if (preparedEvidence.frontImageCrop) {
		formData.set(
			"frontImageCrop",
			JSON.stringify(preparedEvidence.frontImageCrop),
		);
	}
	if (preparedEvidence.nutritionPhoto) {
		formData.set("nutritionPhoto", preparedEvidence.nutritionPhoto);
	}
	if (preparedEvidence.barcodePhoto)
		formData.set("barcodePhoto", preparedEvidence.barcodePhoto);

	if (estimateFormDataBytes(formData) > MAX_CATALOG_INTAKE_REQUEST_BYTES) {
		context.onProgress?.({ phase: "failed" });
		throw new UserFacingError(
			"The prepared photos are still too large to upload together. Choose clearer, smaller photos and try again.",
		);
	}

	let response: Response;
	try {
		response = await submitFormData(formData, context.onProgress);
	} catch (error) {
		context.onProgress?.({ phase: "failed" });
		throw error;
	}

	if (!response.ok) {
		context.onProgress?.({ phase: "failed" });
		throw await createUserFacingErrorFromResponse(
			response,
			"CATALOG_SUBMISSION_FAILED",
		);
	}

	context.onProgress?.({ phase: "uploaded" });
	return (await response.json()) as SharedProductSubmissionResult;
};
