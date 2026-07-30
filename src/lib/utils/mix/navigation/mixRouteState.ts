import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

export const MIX_ROUTE_OVERLAYS = {
	save: "save",
	resetGoals: "reset-goals",
	clearIngredients: "clear-ingredients",
	resetAll: "reset-all",
	renameIngredient: "rename-ingredient",
	warningDetails: "warning-details",
	conversionDetails: "conversion-details",
} as const;

export type MixRouteOverlay =
	(typeof MIX_ROUTE_OVERLAYS)[keyof typeof MIX_ROUTE_OVERLAYS];

export type MixRouteState = {
	overlay: MixRouteOverlay | null;
	foodId: number | null;
	listKey: SmoothieListKey | null;
	warningId: string | null;
};

export type MixRouteTarget =
	| { overlay: null }
	| { overlay: typeof MIX_ROUTE_OVERLAYS.save }
	| { overlay: typeof MIX_ROUTE_OVERLAYS.resetGoals }
	| { overlay: typeof MIX_ROUTE_OVERLAYS.clearIngredients }
	| { overlay: typeof MIX_ROUTE_OVERLAYS.resetAll }
	| {
			overlay: typeof MIX_ROUTE_OVERLAYS.renameIngredient;
			foodId: number;
			listKey: SmoothieListKey;
	  }
	| {
			overlay: typeof MIX_ROUTE_OVERLAYS.warningDetails;
			warningId: string;
	  }
	| {
			overlay: typeof MIX_ROUTE_OVERLAYS.conversionDetails;
			foodId: number;
	  };

const EMPTY_MIX_ROUTE_STATE: MixRouteState = {
	overlay: null,
	foodId: null,
	listKey: null,
	warningId: null,
};

const MIX_LIST_ROUTE_SLUGS = {
	[MIX_STORAGE_KEYS.fridge]: "fridge",
	[MIX_STORAGE_KEYS.shoppingList]: "shopping",
} as const;

const parseFoodId = (value: string | undefined) => {
	if (value === undefined || !/^-?\d+$/.test(value)) return null;
	const foodId = Number(value);
	return Number.isSafeInteger(foodId) ? foodId : null;
};

const getListKey = (value: string | undefined): SmoothieListKey | null => {
	if (value === MIX_LIST_ROUTE_SLUGS[MIX_STORAGE_KEYS.fridge]) {
		return MIX_STORAGE_KEYS.fridge;
	}
	if (value === MIX_LIST_ROUTE_SLUGS[MIX_STORAGE_KEYS.shoppingList]) {
		return MIX_STORAGE_KEYS.shoppingList;
	}
	return null;
};

const getSegments = (pathname: string) =>
	pathname
		.split("/")
		.filter(Boolean)
		.map((segment) => decodeURIComponent(segment));

export const getMixRouteState = (url: URL): MixRouteState => {
	const [root, first, second, third, ...remaining] = getSegments(url.pathname);
	if (root !== "mix" || remaining.length > 0) return EMPTY_MIX_ROUTE_STATE;
	if (first === undefined) return EMPTY_MIX_ROUTE_STATE;

	if (first === MIX_ROUTE_OVERLAYS.save && second === undefined) {
		return { ...EMPTY_MIX_ROUTE_STATE, overlay: MIX_ROUTE_OVERLAYS.save };
	}
	if (first === MIX_ROUTE_OVERLAYS.resetGoals && second === undefined) {
		return {
			...EMPTY_MIX_ROUTE_STATE,
			overlay: MIX_ROUTE_OVERLAYS.resetGoals,
		};
	}
	if (first === MIX_ROUTE_OVERLAYS.clearIngredients && second === undefined) {
		return {
			...EMPTY_MIX_ROUTE_STATE,
			overlay: MIX_ROUTE_OVERLAYS.clearIngredients,
		};
	}
	if (first === MIX_ROUTE_OVERLAYS.resetAll && second === undefined) {
		return {
			...EMPTY_MIX_ROUTE_STATE,
			overlay: MIX_ROUTE_OVERLAYS.resetAll,
		};
	}

	if (first === "rename") {
		const listKey = getListKey(second);
		const foodId = parseFoodId(third);
		if (listKey && foodId !== null) {
			return {
				...EMPTY_MIX_ROUTE_STATE,
				overlay: MIX_ROUTE_OVERLAYS.renameIngredient,
				listKey,
				foodId,
			};
		}
	}

	if (first === "warnings" && second && third === undefined) {
		return {
			...EMPTY_MIX_ROUTE_STATE,
			overlay: MIX_ROUTE_OVERLAYS.warningDetails,
			warningId: second,
		};
	}

	if (
		first === "ingredients" &&
		parseFoodId(second) !== null &&
		third === MIX_ROUTE_OVERLAYS.conversionDetails
	) {
		return {
			...EMPTY_MIX_ROUTE_STATE,
			overlay: MIX_ROUTE_OVERLAYS.conversionDetails,
			foodId: parseFoodId(second),
		};
	}

	return EMPTY_MIX_ROUTE_STATE;
};

export const buildMixRouteHref = (url: URL, target: MixRouteTarget) => {
	const nextUrl = new URL(url);

	switch (target.overlay) {
		case null:
			nextUrl.pathname = "/mix";
			break;
		case MIX_ROUTE_OVERLAYS.save:
		case MIX_ROUTE_OVERLAYS.resetGoals:
		case MIX_ROUTE_OVERLAYS.clearIngredients:
		case MIX_ROUTE_OVERLAYS.resetAll:
			nextUrl.pathname = `/mix/${target.overlay}`;
			break;
		case MIX_ROUTE_OVERLAYS.renameIngredient:
			nextUrl.pathname = `/mix/rename/${MIX_LIST_ROUTE_SLUGS[target.listKey]}/${target.foodId}`;
			break;
		case MIX_ROUTE_OVERLAYS.warningDetails:
			nextUrl.pathname = `/mix/warnings/${encodeURIComponent(target.warningId)}`;
			break;
		case MIX_ROUTE_OVERLAYS.conversionDetails:
			nextUrl.pathname = `/mix/ingredients/${target.foodId}/${MIX_ROUTE_OVERLAYS.conversionDetails}`;
			break;
	}

	const query = nextUrl.searchParams.toString();
	return `${nextUrl.pathname}${query ? `?${query}` : ""}${nextUrl.hash}`;
};

export const getMixRouteTitle = (url: URL) => {
	const state = getMixRouteState(url);
	switch (state.overlay) {
		case MIX_ROUTE_OVERLAYS.save:
			return "Save Mix";
		case MIX_ROUTE_OVERLAYS.resetGoals:
			return "Reset Nutrition Goals";
		case MIX_ROUTE_OVERLAYS.clearIngredients:
			return "Clear Mix Ingredients";
		case MIX_ROUTE_OVERLAYS.resetAll:
			return "Reset Mix";
		case MIX_ROUTE_OVERLAYS.renameIngredient:
			return "Rename Mix Ingredient";
		case MIX_ROUTE_OVERLAYS.warningDetails:
			return "Mix Warning Details";
		case MIX_ROUTE_OVERLAYS.conversionDetails:
			return "Serving Conversion Details";
		default:
			return "Mix";
	}
};
