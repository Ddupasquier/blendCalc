import type { ReadonlyURL } from "$app/state";
export const SHALLOW_ROUTE_PAGE_STATE_KEYS = {
	ingredients: "ingredientRouteHref",
	mix: "mixRouteHref",
	profile: "profileRouteHref",
	savedRecipes: "savedRecipesRouteHref",
} as const;

export type ShallowRoutePageStateKey =
	(typeof SHALLOW_ROUTE_PAGE_STATE_KEYS)[keyof typeof SHALLOW_ROUTE_PAGE_STATE_KEYS];

export const getActiveShallowRouteHref = (
	pageUrl: ReadonlyURL,
	shallowRouteHref?: string,
) => shallowRouteHref ?? `${pageUrl.pathname}${pageUrl.search}${pageUrl.hash}`;

export const getActiveShallowRouteUrl = (
	pageUrl: ReadonlyURL,
	shallowRouteHref?: string,
) =>
	new URL(getActiveShallowRouteHref(pageUrl, shallowRouteHref), pageUrl.href);

export const createShallowRoutePageState = (
	currentPageState: App.PageState,
	routeStateKey: ShallowRoutePageStateKey,
	routeHref: string,
): App.PageState => ({
	...currentPageState,
	[routeStateKey]: routeHref,
});
