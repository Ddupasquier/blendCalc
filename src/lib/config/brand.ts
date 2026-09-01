import { APP_VERSION } from "$lib/config/version";

export const APP_NAME = "blendCalc";
export const APP_PRODUCTION_ORIGIN = "https://www.blendcalc.food";
export const APP_DESCRIPTION =
	"A food-awareness tool for organizing food, reviewing nutrition, recalls, allergens, and dietary details, and building recipes.";
export const APP_SOCIAL_PREVIEW_URL = `${APP_PRODUCTION_ORIGIN}/social-preview.png?v=20260831`;
export const APP_SOCIAL_PREVIEW_ALT = `${APP_NAME} preview for food organization, nutrition, recalls, allergens, dietary details, and recipes`;
export const APP_USER_AGENT = `${APP_NAME}/${APP_VERSION} (${APP_PRODUCTION_ORIGIN})`;
