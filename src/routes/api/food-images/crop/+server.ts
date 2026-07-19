import { json, error as kitError } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { updateFoodImageAssetPlacement } from "$lib/server/products/foodImages.server";
import { getUserAppRole } from "$lib/utils/moderation/moderation";
import type { FoodImageAsset } from "$lib/utils/food/types";
import {
	CURRENT_IMAGE_PLACEMENT_VERSION,
	IMAGE_PLACEMENT_MAX_ZOOM,
	isImageFitMode,
} from "$lib/utils/food/images/imagePlacement";
import type { ImageFitMode } from "$lib/utils/food/images/types";

const allowedSources = new Set<FoodImageAsset["source"]>([
	"open-food-facts",
	"wikimedia-commons",
	"community-reviewed",
]);
const allowedRoles = new Set<FoodImageAsset["role"]>([
	"front",
	"nutrition",
	"barcode",
	"ingredient",
	"generic",
]);
const clamp = (value: unknown, min: number, max: number, fallback: number) => {
	const numberValue = Number(value);
	if (!Number.isFinite(numberValue)) return fallback;
	return Math.min(max, Math.max(min, numberValue));
};

export const PATCH: RequestHandler = async ({ locals, request }) => {
	const user = await locals.getVerifiedUser();
	if (!user) throw kitError(401, "Sign in before updating image placement.");

	const role = await getUserAppRole(locals.supabase, user.id);
	if (role !== "admin" && role !== "moderator") {
		throw kitError(403, "Only moderators and admins can update product image placement.");
	}

	const body = await request.json();
	const source = String(body.source ?? "") as FoodImageAsset["source"];
	const sourceReference = String(body.sourceReference ?? "").trim();
	const imageRole = String(body.role ?? "") as FoodImageAsset["role"];
	const requestedFitMode = String(body.fitMode ?? "");

	if (
		!allowedSources.has(source) ||
		!sourceReference ||
		!allowedRoles.has(imageRole) ||
		!isImageFitMode(requestedFitMode)
	) {
		throw kitError(400, "Choose a valid image to update.");
	}
	const fitMode: ImageFitMode = requestedFitMode;

	const image = await updateFoodImageAssetPlacement({
		source,
		sourceReference,
		role: imageRole,
		moderatorId: user.id,
		crop: {
			cropX: clamp(body.cropX, 0, 100, 50),
			cropY: clamp(body.cropY, 0, 100, 50),
			cropZoom: clamp(body.cropZoom, 1, IMAGE_PLACEMENT_MAX_ZOOM, 1),
			fitMode,
			placementVersion: CURRENT_IMAGE_PLACEMENT_VERSION,
		},
	});

	if (!image) throw kitError(404, "That product image could not be found.");

	return json({ image });
};
