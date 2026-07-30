import { describe, expect, it } from "vitest";
import {
	buildMixRouteHref,
	getMixRouteState,
	getMixRouteTitle,
	MIX_ROUTE_OVERLAYS,
} from "$lib/utils/mix/navigation/mixRouteState";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

const url = (path: string) => new URL(path, "https://blendcalc.test");

describe("mix route state", () => {
	it("parses every URL-backed overlay", () => {
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
		expect(
			getMixRouteState(url("/mix/rename/shopping/42")),
		).toMatchObject({
			overlay: MIX_ROUTE_OVERLAYS.renameIngredient,
			listKey: MIX_STORAGE_KEYS.shoppingList,
			foodId: 42,
		});
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
				overlay: MIX_ROUTE_OVERLAYS.save,
			}),
		).toBe("/mix/save?view=chart");
		expect(
			buildMixRouteHref(url("/mix/save?view=chart"), {
				overlay: MIX_ROUTE_OVERLAYS.renameIngredient,
				listKey: MIX_STORAGE_KEYS.fridge,
				foodId: 91,
			}),
		).toBe("/mix/rename/fridge/91?view=chart");
		expect(
			buildMixRouteHref(url("/mix/reset-all?view=chart"), {
				overlay: null,
			}),
		).toBe("/mix?view=chart");
	});

	it("provides descriptive titles for overlay routes", () => {
		expect(getMixRouteTitle(url("/mix"))).toBe("Mix");
		expect(getMixRouteTitle(url("/mix/save"))).toBe("Save Mix");
		expect(
			getMixRouteTitle(url("/mix/ingredients/42/conversion-details")),
		).toBe("Serving Conversion Details");
	});
});
