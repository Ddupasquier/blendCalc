import { APP_NAME, APP_PRODUCTION_ORIGIN } from "$lib/config/brand";
import { getIngredientRouteTitle } from "$lib/utils/ingredients/ingredientRouteState";

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
	if (pathname === "/fridge" || pathname.startsWith("/fridge/")) {
		return formatDocumentTitle(
			getIngredientRouteTitle(url, ingredientName),
		);
	}
	if (pathname === "/mix") return formatDocumentTitle("Smoothie Builder");
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
