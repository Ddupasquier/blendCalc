import { APP_VERSION } from "$lib/config/version";

export const APP_NAME = "blendCalc";
export const APP_PRODUCTION_ORIGIN = "https://blendcalc.vercel.app";
export const APP_DESCRIPTION =
	"A food and nutrition awareness tool for understanding ingredients, building combinations, and comparing them with your goals.";
export const APP_OG_IMAGE_URL = `${APP_PRODUCTION_ORIGIN}/og-image.png`;
export const APP_NUTRITION_PREVIEW_ALT = `${APP_NAME} nutrition graph preview`;
export const APP_USER_AGENT = `${APP_NAME}/${APP_VERSION} (${APP_PRODUCTION_ORIGIN})`;
