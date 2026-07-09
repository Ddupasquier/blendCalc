import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { FoodImageAsset } from "$lib/utils/food/types";
import {
	getAvatarExtension,
	isProfileAvatarType,
} from "$lib/utils/profile/profileValidation";
import { PRODUCT_EVIDENCE_BUCKET } from "./productEvidence.server";

export const PUBLIC_FOOD_IMAGE_BUCKET = "food-image-assets";

export type FoodImageCropValues = {
	cropX?: number | null;
	cropY?: number | null;
	cropZoom?: number | null;
	cropSource?: FoodImageAsset["cropSource"] | null;
};

const clampCropValue = (value: number | null | undefined, fallback: number) =>
	Number.isFinite(value) ? Math.min(100, Math.max(0, Number(value))) : fallback;

const clampCropZoom = (value: number | null | undefined) =>
	Number.isFinite(value) ? Math.min(4, Math.max(1, Number(value))) : 1;

const normalizeCrop = (crop: FoodImageCropValues = {}) => ({
	crop_x: clampCropValue(crop.cropX, 50),
	crop_y: clampCropValue(crop.cropY, 50),
	crop_zoom: clampCropZoom(crop.cropZoom),
	crop_source: crop.cropSource ?? "auto",
});

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
		...normalizeCrop({
			cropX: image.cropX,
			cropY: image.cropY,
			cropZoom: image.cropZoom,
			cropSource: image.cropSource,
		}),
		approved_by: image.approvedBy ?? null,
		approved_at: image.approvedAt ?? null,
		status: "active",
		fetched_at: image.fetchedAt ?? new Date().toISOString(),
	};

	const { data, error } = await admin
		.from("food_image_assets")
		.update(payload)
		.eq("source", image.source)
		.eq("source_reference", image.sourceReference)
		.eq("image_role", image.role)
		.select("id")
		.maybeSingle();

	if (error) throw error;
	if (data) return;

	const { error: insertError } = await admin
		.from("food_image_assets")
		.insert(payload);
	if (insertError && insertError.code !== "23505") throw insertError;
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
	crop?: FoodImageCropValues;
}) => {
	if (!evidencePath || (!barcode && !sharedProductId)) return null;

	const admin = getSupabaseAdminClient();
	const { data: evidence, error: downloadError } = await admin.storage
		.from(PRODUCT_EVIDENCE_BUCKET)
		.download(evidencePath);
	if (downloadError || !evidence) {
		throw downloadError ?? new Error("Product image evidence could not be loaded.");
	}

	const contentType = isProfileAvatarType(evidence.type)
		? evidence.type
		: "image/jpeg";
	const extension = getAvatarExtension(contentType);
	const safeBarcode = barcode ?? "shared-product";
	const storagePath = `${safeBarcode}/${sharedProductId ?? randomUUID()}/front.${extension}`;
	const bytes = Buffer.from(await evidence.arrayBuffer());
	const { error: uploadError } = await admin.storage
		.from(PUBLIC_FOOD_IMAGE_BUCKET)
		.upload(storagePath, bytes, { contentType, upsert: true });
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
		...normalizeCrop({
			...crop,
			cropSource: crop?.cropSource ?? "moderator",
		}),
		approved_by: moderatorId,
		approved_at: now,
		status: "active",
		fetched_at: now,
	};

	const { data: existingImage, error: updateError } = await admin
		.from("food_image_assets")
		.update(payload)
		.eq("source", payload.source)
		.eq("source_reference", payload.source_reference)
		.eq("image_role", payload.image_role)
		.select("id")
		.maybeSingle();
	if (updateError) throw updateError;

	if (!existingImage) {
		const { error: insertError } = await admin
			.from("food_image_assets")
			.insert(payload);
		if (insertError && insertError.code !== "23505") throw insertError;
	}

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
		cropSource: payload.crop_source,
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
	crop: FoodImageCropValues;
}) => {
	const admin = getSupabaseAdminClient();
	const now = new Date().toISOString();
	const payload = {
		...normalizeCrop({
			...crop,
			cropSource: "moderator",
		}),
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
			"source, source_reference, image_role, image_url, thumbnail_url, storage_path, license_name, license_url, attribution_text, confidence, crop_x, crop_y, crop_zoom, crop_source, approved_by, approved_at, fetched_at",
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
		cropSource: data.crop_source as FoodImageAsset["cropSource"],
		approvedBy: data.approved_by ?? undefined,
		approvedAt: data.approved_at ?? undefined,
		fetchedAt: data.fetched_at,
	} satisfies FoodImageAsset;
};
