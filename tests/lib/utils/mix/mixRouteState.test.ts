import { describe, expect, it } from "vitest";
import {
	buildMixRouteHref,
	getActiveMixRouteHref,
	getActiveMixRouteState,
	getMixRouteState,
	getMixRouteTitle,
	MIX_ROUTE_OVERLAYS,
} from "$lib/utils/mix/navigation/mixRouteState";

const url = (path: string) => new URL(path, "https://blendcalc.test");

describe("mix route state", () => {
	it("parses every URL-backed overlay", () => {
		expect(getMixRouteState(url("/mix/options")).overlay).toBe(
			MIX_ROUTE_OVERLAYS.options,
		);
		expect(getMixRouteState(url("/mix/reorganize")).overlay).toBe(
			MIX_ROUTE_OVERLAYS.reorganize,
		);
		expect(getMixRouteState(url("/mix/ingredients/filters")).overlay).toBe(
			MIX_ROUTE_OVERLAYS.ingredientFilters,
		);
		expect(getMixRouteState(url("/mix/save")).overlay).toBe(
			MIX_ROUTE_OVERLAYS.save,
		);
		expect(getMixRouteState(url("/mix/reset-goals")).overlay).toBe(
			MIX_ROUTE_OVERLAYS.resetGoals,
		);
		expect(getMixRouteState(url("/mix/clear-ingredients")).overlay).toBe(
			MIX_ROUTE_OVERLAYS.clearIngredients,
		);
		expect(getMixRouteState(url("/mix/reset-all")).overlay).toBe(
			MIX_ROUTE_OVERLAYS.resetAll,
		);
		expect(getMixRouteState(url("/mix/warnings/allergen"))).toMatchObject({
			overlay: MIX_ROUTE_OVERLAYS.warningDetails,
			warningId: "allergen",
		});
		expect(
			getMixRouteState(url("/mix/ingredients/42/conversion-details")),
		).toMatchObject({
			overlay: MIX_ROUTE_OVERLAYS.conversionDetails,
			foodId: 42,
		});
	});

	it("builds overlay paths without discarding supported query modifiers", () => {
		expect(
			buildMixRouteHref(url("/mix?view=chart"), {
				overlay: MIX_ROUTE_OVERLAYS.options,
			}),
		).toBe("/mix/options?view=chart");
		expect(
			buildMixRouteHref(url("/mix?view=chart"), {
				overlay: MIX_ROUTE_OVERLAYS.save,
			}),
		).toBe("/mix/save?view=chart");
		expect(
			buildMixRouteHref(url("/mix?view=chart"), {
				overlay: MIX_ROUTE_OVERLAYS.reorganize,
			}),
		).toBe("/mix/reorganize?view=chart");
		expect(
			buildMixRouteHref(url("/mix?view=chart"), {
				overlay: MIX_ROUTE_OVERLAYS.ingredientFilters,
			}),
		).toBe("/mix/ingredients/filters?view=chart");
		expect(
			buildMixRouteHref(url("/mix/reset-all?view=chart"), {
				overlay: null,
			}),
		).toBe("/mix?view=chart");
	});

	it("uses shallow navigation state immediately without waiting for a reload", () => {
		const currentUrl = url("/mix?view=chart");
		const optionsHref = "/mix/options?view=chart";

		expect(getActiveMixRouteHref(currentUrl)).toBe("/mix?view=chart");
		expect(getActiveMixRouteHref(currentUrl, optionsHref)).toBe(optionsHref);
		expect(getActiveMixRouteState(currentUrl, optionsHref).overlay).toBe(
			MIX_ROUTE_OVERLAYS.options,
		);
		expect(getActiveMixRouteState(currentUrl).overlay).toBeNull();
	});

	it("treats the retired Mix rename path as the base Mix view", () => {
		expect(getMixRouteState(url("/mix/rename/fridge/91"))).toEqual({
			overlay: null,
			foodId: null,
			warningId: null,
		});
	});

	it("provides descriptive titles for overlay routes", () => {
		expect(getMixRouteTitle(url("/mix"))).toBe("Mix");
		expect(getMixRouteTitle(url("/mix/options"))).toBe("Mix Options");
		expect(getMixRouteTitle(url("/mix/reorganize"))).toBe("Reorganize Mix");
		expect(getMixRouteTitle(url("/mix/ingredients/filters"))).toBe(
			"Filter Mix Ingredients",
		);
		expect(getMixRouteTitle(url("/mix/save"))).toBe("Save Mix");
		expect(
			getMixRouteTitle(url("/mix/ingredients/42/conversion-details")),
		).toBe("Serving Conversion Details");
	});
});
