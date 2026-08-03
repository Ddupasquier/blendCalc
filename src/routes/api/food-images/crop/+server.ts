import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { updateFoodImageAssetPlacement } from "$lib/server/products/foodImages.server";
import {
  requireAppValue,
  throwAppError,
} from "$lib/server/errors/appError.server";
import {
  getUserAppRole,
  isModerationAppRole,
} from "$lib/utils/moderation/moderation";
import type { FoodImageAsset } from "$lib/utils/food/types";
import {
  CURRENT_IMAGE_PLACEMENT_VERSION,
  CARD_IMAGE_PLACEMENT_MAX_X,
  CARD_IMAGE_PLACEMENT_MIN_X,
  IMAGE_PLACEMENT_MAX_ZOOM,
  isImageFitMode,
  isImagePlacementMethod,
  isImageRotationDegrees,
} from "$lib/utils/food/images/imagePlacement";
import type {
  ImageFitMode,
  ImagePlacementMethod,
  ImageRotationDegrees,
} from "$lib/utils/food/images/types";
import { readLimitedJson } from "$lib/server/security/requestBody.server";

const IMAGE_PLACEMENT_REQUEST_MAX_BYTES = 32 * 1024;

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
  const user = requireAppValue(
    await locals.getVerifiedUser(),
    401,
    "AUTH_REQUIRED",
  );

  const role = await getUserAppRole(locals.supabase, user.id);
  if (!isModerationAppRole(role)) {
    throwAppError(403, "ACCESS_DENIED");
  }

  const body = requireAppValue(
    (await readLimitedJson(
      request,
      IMAGE_PLACEMENT_REQUEST_MAX_BYTES,
    )) as Record<string, unknown> | null,
    400,
    "IMAGE_PLACEMENT_INVALID",
  );
  const source = String(body.source ?? "") as FoodImageAsset["source"];
  const sourceReference = String(body.sourceReference ?? "").trim();
  const imageRole = String(body.role ?? "") as FoodImageAsset["role"];
  const requestedFitMode = body.fitMode;
  const requestedRotationDegrees = Number(body.rotationDegrees ?? 0);
  const requestedPlacementMethod = body.placementMethod ?? "manual";
  const suggestionVersion = String(body.suggestionVersion ?? "").trim();
  const suggestionConfidence = Number(body.suggestionConfidence);

  if (
    !allowedSources.has(source) ||
    !sourceReference ||
    !allowedRoles.has(imageRole)
  ) {
    throwAppError(400, "IMAGE_PLACEMENT_INVALID");
  }
  if (!isImageFitMode(requestedFitMode)) {
    throwAppError(400, "IMAGE_PLACEMENT_INVALID");
  }
  if (!isImageRotationDegrees(requestedRotationDegrees)) {
    throwAppError(400, "IMAGE_PLACEMENT_INVALID");
  }
  if (!isImagePlacementMethod(requestedPlacementMethod)) {
    throwAppError(400, "IMAGE_PLACEMENT_INVALID");
  }
  const usesSmartSuggestion =
    requestedPlacementMethod === "smart-ocr" ||
    requestedPlacementMethod === "smart-ocr-adjusted";
  if (
    usesSmartSuggestion &&
    (!suggestionVersion || !Number.isFinite(suggestionConfidence))
  ) {
    throwAppError(400, "IMAGE_PLACEMENT_INVALID");
  }
  const fitMode = requestedFitMode as ImageFitMode;
  const placementMethod = requestedPlacementMethod as ImagePlacementMethod;
  const rotationDegrees = requestedRotationDegrees as ImageRotationDegrees;

  const image = await updateFoodImageAssetPlacement({
    source,
    sourceReference,
    role: imageRole,
    moderatorId: user.id,
    crop: {
      cropX: clamp(
        body.cropX,
        CARD_IMAGE_PLACEMENT_MIN_X,
        CARD_IMAGE_PLACEMENT_MAX_X,
        CARD_IMAGE_PLACEMENT_MIN_X,
      ),
      cropY: clamp(body.cropY, 0, 100, 50),
      cropZoom: clamp(body.cropZoom, 1, IMAGE_PLACEMENT_MAX_ZOOM, 1),
      rotationDegrees,
      fitMode,
      placementVersion: CURRENT_IMAGE_PLACEMENT_VERSION,
      placementMethod,
      ...(usesSmartSuggestion
        ? {
            suggestionVersion,
            suggestionConfidence: clamp(suggestionConfidence, 0, 100, 0),
          }
        : {}),
    },
  });

  if (!image) throwAppError(404, "IMAGE_NOT_FOUND");

  return json({ image });
};
