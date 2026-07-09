import { json, error as kitError } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { updateFoodImageAssetPlacement } from "$lib/server/products/foodImages.server";
import { getUserAppRole } from "$lib/utils/moderation/moderation";
import type { FoodImageAsset } from "$lib/utils/food/types";

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
	const { user } = await locals.safeGetSession();
	if (!user) throw kitError(401, "Sign in before updating image placement.");

	const role = await getUserAppRole(locals.supabase, user.id);
	if (role !== "admin" && role !== "moderator") {
		throw kitError(403, "Only moderators and admins can update product image placement.");
	}

	const body = await request.json();
	const source = String(body.source ?? "") as FoodImageAsset["source"];
	const sourceReference = String(body.sourceReference ?? "").trim();
	const imageRole = String(body.role ?? "") as FoodImageAsset["role"];

	if (!allowedSources.has(source) || !sourceReference || !allowedRoles.has(imageRole)) {
		throw kitError(400, "Choose a valid image to update.");
	}

	const image = await updateFoodImageAssetPlacement({
		source,
		sourceReference,
		role: imageRole,
		moderatorId: user.id,
		crop: {
			cropX: clamp(body.cropX, 0, 100, 50),
			cropY: clamp(body.cropY, 0, 100, 50),
			cropZoom: clamp(body.cropZoom, 1, 4, 1),
		},
	});

	if (!image) throw kitError(404, "That product image could not be found.");

	return json({ image });
};
