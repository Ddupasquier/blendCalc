import { APP_NAME, APP_PRODUCTION_ORIGIN } from "$lib/config/brand";
import { getIngredientRouteTitle } from "$lib/utils/ingredients/ingredientRouteState";
import { getMixRouteTitle } from "$lib/utils/mix/navigation/mixRouteState";

export const formatDocumentTitle = (title: string) =>
	`${title.trim()} · ${APP_NAME}`;

export const getAppDocumentTitle = (
	url: URL,
	ingredientName?: string | null,
) => {
	const { pathname } = url;

	if (pathname === "/") {
		return formatDocumentTitle("Smoothie Nutrition Calculator");
	}
	if (pathname === "/auth") return formatDocumentTitle("Sign In");
	if (pathname === "/auth/update-password") {
		return formatDocumentTitle("Update Password");
	}
	if (
		pathname === "/ingredients/fridge" ||
		pathname.startsWith("/ingredients/fridge/") ||
		pathname === "/ingredients/shopping" ||
		pathname.startsWith("/ingredients/shopping/")
	) {
		return formatDocumentTitle(
			getIngredientRouteTitle(url, ingredientName),
		);
	}
	if (pathname === "/mix" || pathname.startsWith("/mix/")) {
		return formatDocumentTitle(getMixRouteTitle(url));
	}
	if (pathname === "/saved/sort") {
		return formatDocumentTitle("Sort Saved Drinks");
	}
	if (pathname === "/saved") return formatDocumentTitle("Saved Drinks");
	if (pathname === "/profile/tutorial") {
		return formatDocumentTitle("Quick Tutorial");
	}
	if (pathname === "/profile") return formatDocumentTitle("Profile");
	if (pathname === "/moderation") return formatDocumentTitle("Moderation");

	return APP_NAME;
};

export const getCanonicalAppUrl = (url: URL) =>
	`${APP_PRODUCTION_ORIGIN}${url.pathname}`;
