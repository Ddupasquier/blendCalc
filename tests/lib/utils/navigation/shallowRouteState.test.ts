import { describe, expect, it } from "vitest";
import {
	createShallowRoutePageState,
	getActiveShallowRouteHref,
	getActiveShallowRouteUrl,
	SHALLOW_ROUTE_PAGE_STATE_KEYS,
} from "$lib/utils/navigation/shallowRouteState";

describe("shallow route state", () => {
	it("uses explicit shallow history state before the server-loaded URL changes", () => {
		const pageUrl = new URL("https://blendcalc.test/saved?query=berry");
		const shallowRouteHref = "/saved/sort?query=berry";

		expect(getActiveShallowRouteHref(pageUrl)).toBe("/saved?query=berry");
		expect(getActiveShallowRouteHref(pageUrl, shallowRouteHref)).toBe(
			shallowRouteHref,
		);
		expect(
			getActiveShallowRouteUrl(pageUrl, shallowRouteHref).pathname,
		).toBe("/saved/sort");
	});

	it("preserves unrelated page state while recording a domain route href", () => {
		const currentPageState: App.PageState = {
			ingredientRouteHref: "/ingredients/fridge/search",
		};

		expect(
			createShallowRoutePageState(
				currentPageState,
				SHALLOW_ROUTE_PAGE_STATE_KEYS.savedRecipes,
				"/saved/sort",
			),
		).toEqual({
			ingredientRouteHref: "/ingredients/fridge/search",
			savedRecipesRouteHref: "/saved/sort",
		});
	});
});
