import {
	assertCanSubmitSharedProduct,
	ProductSubmissionBlockedError,
	submitProductForCatalog,
} from "$lib/server/products/catalog.server";
import {
	deleteProductEvidence,
	uploadProductEvidence,
	type ProductEvidenceFiles,
	type ProductEvidencePaths,
} from "$lib/server/products/productEvidence.server";
import type { FdcFood } from "$lib/utils/food/types";
import {
	CURRENT_IMAGE_PLACEMENT_VERSION,
	constrainCardImagePlacement,
	isImageFitMode,
	isImagePlacementMethod,
	isImageRotationDegrees,
} from "$lib/utils/food/images/imagePlacement";
import type { ImagePlacementValue } from "$lib/utils/food/images/types";
import {
	requireAppValue,
	throwAppError,
} from "$lib/server/errors/appError.server";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const PRODUCT_SUBMISSION_REQUEST_MAX_BYTES = 25 * 1024 * 1024;

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireAppValue(
		await locals.getVerifiedUser(),
		401,
		"AUTH_REQUIRED",
	);

	try {
		await assertCanSubmitSharedProduct(user.id);
	} catch (submissionError) {
		if (submissionError instanceof ProductSubmissionBlockedError) {
			throwAppError(submissionError.status, "CATALOG_SUBMISSION_BLOCKED", {
				blockedUntil: submissionError.displayBlockedUntil,
			});
		}
		console.error("[catalog submission] Eligibility check failed", submissionError);
		return throwAppError(503, "CATALOG_VALIDATION_UNAVAILABLE");
	}

	const formData = await readLimitedFormData(
		request,
		PRODUCT_SUBMISSION_REQUEST_MAX_BYTES,
	);
	const foodValue = formData.get("food");
	const consentToShare = formData.get("consentToShare") === "true";
	let food: FdcFood | null = null;
	try {
		food = foodValue ? JSON.parse(String(foodValue)) as FdcFood : null;
	} catch {
		throwAppError(400, "CATALOG_SUBMISSION_INVALID");
	}
	const submissionFood = requireAppValue(
		food,
		400,
		"CATALOG_SUBMISSION_INVALID",
	);
	if (!consentToShare) throwAppError(400, "CATALOG_CONSENT_REQUIRED");
	const reviewFlagsValue = formData.get("reviewFlags");
	let reviewFlags: string[] = [];
	if (reviewFlagsValue) {
		try {
			const parsedFlags = JSON.parse(String(reviewFlagsValue));
			reviewFlags = Array.isArray(parsedFlags)
				? parsedFlags
						.filter((flag): flag is string => typeof flag === "string")
						.map((flag) => flag.trim())
						.filter(Boolean)
						.slice(0, 10)
				: [];
		} catch {
			throwAppError(400, "CATALOG_REVIEW_FLAGS_INVALID");
		}
	}

	const evidenceFiles = Object.fromEntries(
		(["front", "nutrition", "barcode"] as const).flatMap((role) => {
			const value = formData.get(`${role}Photo`);
			return value instanceof File && value.size > 0 ? [[role, value]] : [];
		}),
	) as ProductEvidenceFiles;
	const frontImageCropValue = formData.get("frontImageCrop");
	let frontImageCrop: ImagePlacementValue | null = null;
	if (frontImageCropValue) {
		try {
			const parsedCrop = JSON.parse(String(frontImageCropValue)) as {
				cropX?: unknown;
				cropY?: unknown;
				cropZoom?: unknown;
				rotationDegrees?: unknown;
				fitMode?: unknown;
				placementMethod?: unknown;
				suggestionVersion?: unknown;
				suggestionConfidence?: unknown;
			};
			const placementMethod = isImagePlacementMethod(
					parsedCrop.placementMethod,
				)
				? parsedCrop.placementMethod
				: "manual";
			const usesSmartSuggestion =
				placementMethod === "smart-ocr" ||
				placementMethod === "smart-ocr-adjusted";
			const suggestionVersion =
				typeof parsedCrop.suggestionVersion === "string"
					? parsedCrop.suggestionVersion.trim()
					: "";
			const suggestionConfidence = Number(parsedCrop.suggestionConfidence);
			if (
				![parsedCrop.cropX, parsedCrop.cropY, parsedCrop.cropZoom].every((value) =>
					Number.isFinite(Number(value))) ||
				!isImageRotationDegrees(Number(parsedCrop.rotationDegrees ?? 0)) ||
				!isImageFitMode(parsedCrop.fitMode) ||
				(
					usesSmartSuggestion &&
					(!suggestionVersion || !Number.isFinite(suggestionConfidence))
				)
			) {
				throw new Error("Invalid image placement");
			}
			frontImageCrop = constrainCardImagePlacement({
				cropX: Number(parsedCrop.cropX),
				cropY: Number(parsedCrop.cropY),
				cropZoom: Number(parsedCrop.cropZoom),
				rotationDegrees: Number(
					parsedCrop.rotationDegrees ?? 0,
				) as ImagePlacementValue["rotationDegrees"],
				fitMode: parsedCrop.fitMode,
				placementVersion: CURRENT_IMAGE_PLACEMENT_VERSION,
				placementMethod,
				...(usesSmartSuggestion
					? {
						suggestionVersion,
						suggestionConfidence,
					}
					: {}),
			});
		} catch {
			throwAppError(400, "IMAGE_PLACEMENT_INVALID");
		}
	}
	let evidencePaths: ProductEvidencePaths = {};

	try {
		evidencePaths = await uploadProductEvidence(user.id, evidenceFiles);
		const result = await submitProductForCatalog(user.id, submissionFood, evidencePaths, {
			reviewFlags,
			frontImageCrop,
		});
		if (result.evidenceAccepted !== true) {
			await deleteProductEvidence(evidencePaths);
		}
		return json(result, { status: 201 });
	} catch (submissionError) {
		await deleteProductEvidence(evidencePaths);
		if (submissionError instanceof ProductSubmissionBlockedError) {
			throwAppError(submissionError.status, "CATALOG_SUBMISSION_BLOCKED", {
				blockedUntil: submissionError.displayBlockedUntil,
			});
		}
		console.error("[catalog submission] Product submission failed", submissionError);
		return throwAppError(500, "CATALOG_SUBMISSION_FAILED");
	}
};
