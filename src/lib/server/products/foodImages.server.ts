import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { normalizeImageUpload } from "$lib/server/uploads/normalizeImageUpload.server";
import {
	constrainCardImagePlacement,
	normalizeImageRotationDegrees,
} from "$lib/utils/food/images/imagePlacement";
import type { ImagePlacementValue } from "$lib/utils/food/images/types";
import type { FoodImageAsset } from "$lib/utils/food/types";
import {
	isProfileAvatarType,
	matchesAvatarFileSignature,
} from "$lib/utils/profile/profileValidation";
import {
	PRODUCT_EVIDENCE_BUCKET,
	PRODUCT_EVIDENCE_MAX_BYTES,
} from "./productEvidence.server";

export const PUBLIC_FOOD_IMAGE_BUCKET = "food-image-assets";
const PUBLIC_FOOD_IMAGE_MAX_DIMENSION = 4096;

export type FoodImagePlacementValues = Partial<ImagePlacementValue> & {
	cropSource?: FoodImageAsset["cropSource"] | null;
	suggestionAcceptedAt?: string | null;
};

const normalizePlacement = (
	value: FoodImagePlacementValues = {},
	suggestionAcceptedAt?: string | null,
) => {
	const placement = constrainCardImagePlacement(value);
	const usesSmartSuggestion =
		placement.placementMethod === "smart-ocr" ||
		placement.placementMethod === "smart-ocr-adjusted";
	return {
		crop_x: placement.cropX,
		crop_y: placement.cropY,
		crop_zoom: placement.cropZoom,
		rotation_degrees: placement.rotationDegrees,
		fit_mode: placement.fitMode,
		placement_version: placement.placementVersion,
		crop_source: value.cropSource ?? "auto",
		placement_method: placement.placementMethod ?? "manual",
		placement_suggestion_version: usesSmartSuggestion
			? placement.suggestionVersion ?? null
			: null,
		placement_suggestion_confidence: usesSmartSuggestion
			? placement.suggestionConfidence ?? null
			: null,
		placement_suggestion_accepted_at: usesSmartSuggestion
			? suggestionAcceptedAt ?? value.suggestionAcceptedAt ?? null
			: null,
	};
};

export const persistFoodImageAsset = async ({
	image,
	barcode,
	sharedProductId,
}: {
	image?: FoodImageAsset | null;
	barcode?: string | null;
	sharedProductId?: string | null;
}) => {
	if (!image?.imageUrl || !image.sourceReference) return;

	const admin = getSupabaseAdminClient();
	const payload = {
		barcode: barcode || null,
		shared_product_id: sharedProductId || null,
		source: image.source,
		source_reference: image.sourceReference,
		image_role: image.role,
		image_url: image.imageUrl,
		thumbnail_url: image.thumbnailUrl ?? null,
		storage_path: image.storagePath ?? null,
		license_name: image.licenseName,
		license_url: image.licenseUrl ?? null,
		attribution_text: image.attributionText ?? null,
		confidence: image.confidence,
		approved_by: image.approvedBy ?? null,
		approved_at: image.approvedAt ?? null,
		status: "active",
		fetched_at: image.fetchedAt ?? new Date().toISOString(),
	};

	const { error } = await admin
		.from("food_image_assets")
		.upsert(payload, {
			onConflict: "source,source_reference,image_role",
		});

	if (error) throw error;
};

export const publishModeratedFoodImageAsset = async ({
	barcode,
	sharedProductId,
	evidencePath,
	moderatorId,
	crop,
}: {
	barcode?: string | null;
	sharedProductId?: string | null;
	evidencePath: string;
	moderatorId: string;
	crop?: FoodImagePlacementValues;
}) => {
	if (!evidencePath || (!barcode && !sharedProductId)) return null;

	const admin = getSupabaseAdminClient();
	const { data: evidence, error: downloadError } = await admin.storage
		.from(PRODUCT_EVIDENCE_BUCKET)
		.download(evidencePath);
	if (downloadError || !evidence) {
		throw downloadError ?? new Error("Product image evidence could not be loaded.");
	}

	if (!isProfileAvatarType(evidence.type)) {
		throw new Error("Product image evidence has an unsupported file type.");
	}
	const evidenceBytes = new Uint8Array(await evidence.arrayBuffer());
	if (!matchesAvatarFileSignature(evidenceBytes, evidence.type)) {
		throw new Error("Product image evidence does not match its file type.");
	}
	const normalizedImage = await normalizeImageUpload({
		bytes: evidenceBytes,
		maximumOutputBytes: PRODUCT_EVIDENCE_MAX_BYTES,
		maximumWidth: PUBLIC_FOOD_IMAGE_MAX_DIMENSION,
		maximumHeight: PUBLIC_FOOD_IMAGE_MAX_DIMENSION,
	});
	const safeBarcode = barcode ?? "shared-product";
	const storagePath =
		`${safeBarcode}/${sharedProductId ?? randomUUID()}/front.${normalizedImage.extension}`;
	const { error: uploadError } = await admin.storage
		.from(PUBLIC_FOOD_IMAGE_BUCKET)
		.upload(storagePath, normalizedImage.bytes, {
			contentType: normalizedImage.contentType,
			upsert: true,
		});
	if (uploadError) throw uploadError;

	const { data: publicUrlData } = admin.storage
		.from(PUBLIC_FOOD_IMAGE_BUCKET)
		.getPublicUrl(storagePath);
	const imageUrl = publicUrlData.publicUrl;
	const now = new Date().toISOString();

	const payload = {
		barcode: barcode || null,
		shared_product_id: sharedProductId || null,
		source: "community-reviewed" as const,
		source_reference: storagePath,
		image_role: "front" as const,
		image_url: imageUrl,
		thumbnail_url: imageUrl,
		storage_path: storagePath,
		license_name: "Community submitted product image",
		license_url: null,
		attribution_text: "blendCalc community submission",
		confidence: "moderator-reviewed" as const,
		...normalizePlacement(
			{
				...crop,
				cropSource: crop?.cropSource ?? "moderator",
			},
			now,
		),
		approved_by: moderatorId,
		approved_at: now,
		status: "active",
		fetched_at: now,
	};

	const { error: upsertError } = await admin
		.from("food_image_assets")
		.upsert(payload, {
			onConflict: "source,source_reference,image_role",
		});
	if (upsertError) throw upsertError;

	return {
		source: payload.source,
		sourceReference: payload.source_reference,
		role: payload.image_role,
		imageUrl,
		thumbnailUrl: imageUrl,
		storagePath,
		licenseName: payload.license_name,
		attributionText: payload.attribution_text,
		confidence: payload.confidence,
		cropX: payload.crop_x,
		cropY: payload.crop_y,
		cropZoom: payload.crop_zoom,
		rotationDegrees: payload.rotation_degrees,
		fitMode: payload.fit_mode,
		placementVersion: payload.placement_version,
		cropSource: payload.crop_source,
		placementMethod: payload.placement_method,
		suggestionVersion:
			payload.placement_suggestion_version ?? undefined,
		suggestionConfidence:
			payload.placement_suggestion_confidence ?? undefined,
		suggestionAcceptedAt:
			payload.placement_suggestion_accepted_at ?? undefined,
		approvedBy: moderatorId,
		approvedAt: now,
		fetchedAt: now,
	} satisfies FoodImageAsset;
};

export const updateFoodImageAssetPlacement = async ({
	source,
	sourceReference,
	role,
	moderatorId,
	crop,
}: {
	source: FoodImageAsset["source"];
	sourceReference: string;
	role: FoodImageAsset["role"];
	moderatorId: string;
	crop: FoodImagePlacementValues;
}) => {
	const admin = getSupabaseAdminClient();
	const now = new Date().toISOString();
	const payload = {
		...normalizePlacement(
			{
				...crop,
				cropSource: "moderator",
			},
			now,
		),
		approved_by: moderatorId,
		approved_at: now,
	};

	const { data, error } = await admin
		.from("food_image_assets")
		.update(payload)
		.eq("source", source)
		.eq("source_reference", sourceReference)
		.eq("image_role", role)
		.eq("status", "active")
		.select(
			"source, source_reference, image_role, image_url, thumbnail_url, storage_path, license_name, license_url, attribution_text, confidence, crop_x, crop_y, crop_zoom, rotation_degrees, fit_mode, placement_version, crop_source, placement_method, placement_suggestion_version, placement_suggestion_confidence, placement_suggestion_accepted_at, approved_by, approved_at, fetched_at",
		)
		.maybeSingle();
	if (error) throw error;
	if (!data) return null;

	return {
		source: data.source as FoodImageAsset["source"],
		sourceReference: data.source_reference ?? undefined,
		role: data.image_role as FoodImageAsset["role"],
		imageUrl: data.image_url,
		thumbnailUrl: data.thumbnail_url ?? undefined,
		storagePath: data.storage_path ?? undefined,
		licenseName: data.license_name,
		licenseUrl: data.license_url ?? undefined,
		attributionText: data.attribution_text ?? undefined,
		confidence: data.confidence as FoodImageAsset["confidence"],
		cropX: data.crop_x,
		cropY: data.crop_y,
		cropZoom: data.crop_zoom,
		rotationDegrees: normalizeImageRotationDegrees(data.rotation_degrees),
		fitMode: data.fit_mode as FoodImageAsset["fitMode"],
		placementVersion: data.placement_version,
		cropSource: data.crop_source as FoodImageAsset["cropSource"],
		placementMethod:
			data.placement_method as FoodImageAsset["placementMethod"],
		suggestionVersion:
			data.placement_suggestion_version ?? undefined,
		suggestionConfidence:
			data.placement_suggestion_confidence === null
				? undefined
				: Number(data.placement_suggestion_confidence),
		suggestionAcceptedAt:
			data.placement_suggestion_accepted_at ?? undefined,
		approvedBy: data.approved_by ?? undefined,
		approvedAt: data.approved_at ?? undefined,
		fetchedAt: data.fetched_at,
	} satisfies FoodImageAsset;
};
