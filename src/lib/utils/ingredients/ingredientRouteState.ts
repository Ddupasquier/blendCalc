import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { FdcFood } from "$lib/utils/food/types";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

const ACTIONS_PARAM = "actions";
const LEGACY_LIST_TAB_PARAM = "tab";
const FRIDGE_ROUTE_SEGMENT = "fridge";
const LIST_ROUTE_SLUGS = {
	fridge: "fridge",
	shoppingList: "shopping-list",
} as const;

export const INGREDIENT_ROUTE_VIEWS = {
	search: "search",
	nutrition: "nutrition",
} as const;

export const INGREDIENT_ROUTE_SHEETS = {
	manualEntry: "manual-entry",
	filters: "filters",
	ingredientActions: "ingredient-actions",
	imagePlacement: "image-placement",
	renameIngredient: "rename-ingredient",
} as const;

export const INGREDIENT_ROUTE_MODALS = {
	barcodeScanner: "barcode-scanner",
} as const;

export type IngredientRouteView =
	(typeof INGREDIENT_ROUTE_VIEWS)[keyof typeof INGREDIENT_ROUTE_VIEWS];

export type IngredientRouteSheet =
	(typeof INGREDIENT_ROUTE_SHEETS)[keyof typeof INGREDIENT_ROUTE_SHEETS];

export type IngredientRouteModal =
	(typeof INGREDIENT_ROUTE_MODALS)[keyof typeof INGREDIENT_ROUTE_MODALS];

export type IngredientRouteState = {
	view: IngredientRouteView | null;
	sheet: IngredientRouteSheet | null;
	modal: IngredientRouteModal | null;
	foodId: number | null;
	listKey: SmoothieListKey | null;
	showListActions: boolean;
};

export type IngredientRoutePatch = Partial<{
	view: IngredientRouteView | null;
	sheet: IngredientRouteSheet | null;
	modal: IngredientRouteModal | null;
	foodId: number | null;
	listKey: SmoothieListKey | null;
	showListActions: boolean;
}>;

const getListKeyFromRouteSlug = (value: string | null): SmoothieListKey | null => {
	if (value === LIST_ROUTE_SLUGS.fridge || value === MIX_STORAGE_KEYS.fridge) {
		return MIX_STORAGE_KEYS.fridge;
	}
	if (
		value === LIST_ROUTE_SLUGS.shoppingList ||
		value === MIX_STORAGE_KEYS.shoppingList
	) {
		return MIX_STORAGE_KEYS.shoppingList;
	}
	return null;
};

const getRouteSlugFromListKey = (key: SmoothieListKey | null) => {
	if (key === MIX_STORAGE_KEYS.fridge) return LIST_ROUTE_SLUGS.fridge;
	if (key === MIX_STORAGE_KEYS.shoppingList) return LIST_ROUTE_SLUGS.shoppingList;
	return null;
};

const parseFoodId = (value: string | null) => {
	if (!value) return null;
	const foodId = Number(value);
	return Number.isFinite(foodId) ? foodId : null;
};

const getDecodedPathSegments = (pathname: string) =>
	pathname
		.split("/")
		.filter(Boolean)
		.map((segment) => decodeURIComponent(segment));

const getIngredientRouteBasePath = (pathname: string) => {
	const segments = getDecodedPathSegments(pathname);
	const fridgeIndex = segments.indexOf(FRIDGE_ROUTE_SEGMENT);
	if (fridgeIndex === -1) return `/${FRIDGE_ROUTE_SEGMENT}`;
	return `/${segments.slice(0, fridgeIndex + 1).join("/")}`;
};

const getIngredientRoutePathSegments = (pathname: string) => {
	const segments = getDecodedPathSegments(pathname);
	const fridgeIndex = segments.indexOf(FRIDGE_ROUTE_SEGMENT);
	if (fridgeIndex === -1) return [];
	return segments.slice(fridgeIndex + 1);
};

const getIngredientPathContext = (pathname: string) => {
	const routeSegments = getIngredientRoutePathSegments(pathname);
	if (routeSegments[0] === LIST_ROUTE_SLUGS.shoppingList) {
		return {
			listKey: MIX_STORAGE_KEYS.shoppingList,
			routeSegments: routeSegments.slice(1),
		};
	}
	return {
		listKey: MIX_STORAGE_KEYS.fridge,
		routeSegments,
	};
};

const getIngredientListBasePath = (
	pathname: string,
	listKey: SmoothieListKey,
) => {
	const basePath = getIngredientRouteBasePath(pathname);
	return listKey === MIX_STORAGE_KEYS.shoppingList
		? `${basePath}/${LIST_ROUTE_SLUGS.shoppingList}`
		: basePath;
};

export const getIngredientListTab = (url: URL): SmoothieListKey => {
	const pathContext = getIngredientPathContext(url.pathname);
	if (pathContext.listKey === MIX_STORAGE_KEYS.shoppingList) {
		return pathContext.listKey;
	}
	return getListKeyFromRouteSlug(
		url.searchParams.get(LEGACY_LIST_TAB_PARAM),
	) ?? MIX_STORAGE_KEYS.fridge;
};

export const buildIngredientListTabHref = (
	url: URL,
	key: SmoothieListKey,
) => {
	const nextUrl = new URL(url);
	nextUrl.pathname = getIngredientListBasePath(url.pathname, key);
	nextUrl.searchParams.delete(LEGACY_LIST_TAB_PARAM);
	nextUrl.searchParams.delete(ACTIONS_PARAM);
	const query = nextUrl.searchParams.toString();
	return `${nextUrl.pathname}${query ? `?${query}` : ""}${nextUrl.hash}`;
};

const getPathRouteState = (url: URL): IngredientRouteState | null => {
	const pathContext = getIngredientPathContext(url.pathname);
	const [routeSlug, secondSegment, thirdSegment] = pathContext.routeSegments;

	if (!routeSlug) return null;

	if (routeSlug === INGREDIENT_ROUTE_VIEWS.search) {
		return {
			view: INGREDIENT_ROUTE_VIEWS.search,
			sheet: null,
			modal: null,
			foodId: null,
			listKey: null,
			showListActions: true,
		};
	}

	if (routeSlug === INGREDIENT_ROUTE_VIEWS.nutrition) {
		return {
			view: INGREDIENT_ROUTE_VIEWS.nutrition,
			sheet: null,
			modal: null,
			foodId: parseFoodId(secondSegment ?? null),
			listKey: pathContext.listKey,
			showListActions: url.searchParams.get(ACTIONS_PARAM) !== "hide",
		};
	}

	if (routeSlug === INGREDIENT_ROUTE_SHEETS.manualEntry) {
		return {
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.manualEntry,
			modal:
				secondSegment === INGREDIENT_ROUTE_MODALS.barcodeScanner
					? INGREDIENT_ROUTE_MODALS.barcodeScanner
					: null,
			foodId: null,
			listKey: null,
			showListActions: true,
		};
	}

	if (routeSlug === INGREDIENT_ROUTE_SHEETS.filters) {
		return {
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.filters,
			modal: null,
			foodId: null,
			listKey: null,
			showListActions: true,
		};
	}

	if (routeSlug === INGREDIENT_ROUTE_MODALS.barcodeScanner) {
		return {
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.manualEntry,
			modal: INGREDIENT_ROUTE_MODALS.barcodeScanner,
			foodId: null,
			listKey: null,
			showListActions: true,
		};
	}

	if (routeSlug === "actions") {
		const legacyListKey = getListKeyFromRouteSlug(secondSegment ?? null);
		return {
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.ingredientActions,
			modal: null,
			foodId: parseFoodId(
				legacyListKey ? thirdSegment ?? null : secondSegment ?? null,
			),
			listKey: legacyListKey ?? pathContext.listKey,
			showListActions: true,
		};
	}

	if (routeSlug === "rename") {
		const legacyListKey = getListKeyFromRouteSlug(secondSegment ?? null);
		return {
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.renameIngredient,
			modal: null,
			foodId: parseFoodId(
				legacyListKey ? thirdSegment ?? null : secondSegment ?? null,
			),
			listKey: legacyListKey ?? pathContext.listKey,
			showListActions: true,
		};
	}

	if (routeSlug === INGREDIENT_ROUTE_SHEETS.imagePlacement) {
		const legacyListKey = getListKeyFromRouteSlug(secondSegment ?? null);
		return {
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.imagePlacement,
			modal: null,
			foodId: parseFoodId(
				legacyListKey ? thirdSegment ?? null : secondSegment ?? null,
			),
			listKey: legacyListKey ?? pathContext.listKey,
			showListActions: true,
		};
	}

	return null;
};

export const getIngredientRouteState = (url: URL): IngredientRouteState => {
	return getPathRouteState(url) ?? {
		view: null,
		sheet: null,
		modal: null,
		foodId: null,
		listKey: null,
		showListActions: true,
	};
};

export const buildIngredientRouteHref = (
	url: URL,
	patch: IngredientRoutePatch = {},
) => {
	const nextUrl = new URL(url);
	const params = nextUrl.searchParams;
	const current = getIngredientRouteState(url);
	const nextView = patch.view !== undefined ? patch.view : current.view;
	const nextSheet = patch.sheet !== undefined ? patch.sheet : current.sheet;
	const routeModeChanged = patch.view !== undefined || patch.sheet !== undefined;
	const nextModal =
		patch.modal !== undefined
			? patch.modal
			: routeModeChanged
				? null
				: current.modal;
	const nextFoodId = patch.foodId !== undefined ? patch.foodId : current.foodId;
	const nextListKey = patch.listKey !== undefined ? patch.listKey : current.listKey;
	const routeListKey = nextListKey ?? getIngredientListTab(url);
	const listBasePath = getIngredientListBasePath(url.pathname, routeListKey);
	const nextShowListActions =
		patch.showListActions !== undefined
			? patch.showListActions
			: current.showListActions;

	params.delete(ACTIONS_PARAM);
	params.delete(LEGACY_LIST_TAB_PARAM);

	if (nextView) {
		nextUrl.pathname =
			nextView === INGREDIENT_ROUTE_VIEWS.search
				? `${listBasePath}/${INGREDIENT_ROUTE_VIEWS.search}`
				: `${listBasePath}/${INGREDIENT_ROUTE_VIEWS.nutrition}/${nextFoodId ?? ""}`;
		if (nextView === INGREDIENT_ROUTE_VIEWS.nutrition) {
			if (!nextShowListActions) params.set(ACTIONS_PARAM, "hide");
		}
	} else if (nextSheet) {
		if (nextModal === INGREDIENT_ROUTE_MODALS.barcodeScanner) {
			nextUrl.pathname = `${listBasePath}/${INGREDIENT_ROUTE_MODALS.barcodeScanner}`;
		} else if (nextSheet === INGREDIENT_ROUTE_SHEETS.manualEntry) {
			nextUrl.pathname = `${listBasePath}/${INGREDIENT_ROUTE_SHEETS.manualEntry}`;
		} else if (nextSheet === INGREDIENT_ROUTE_SHEETS.filters) {
			nextUrl.pathname = `${listBasePath}/${INGREDIENT_ROUTE_SHEETS.filters}`;
		} else if (nextSheet === INGREDIENT_ROUTE_SHEETS.ingredientActions) {
			nextUrl.pathname = `${listBasePath}/actions/${nextFoodId ?? ""}`;
		} else if (nextSheet === INGREDIENT_ROUTE_SHEETS.renameIngredient) {
			nextUrl.pathname = `${listBasePath}/rename/${nextFoodId ?? ""}`;
		} else if (nextSheet === INGREDIENT_ROUTE_SHEETS.imagePlacement) {
			nextUrl.pathname = `${listBasePath}/${INGREDIENT_ROUTE_SHEETS.imagePlacement}/${nextFoodId ?? ""}`;
		}
	} else {
		nextUrl.pathname =
			nextModal === INGREDIENT_ROUTE_MODALS.barcodeScanner
				? `${listBasePath}/${INGREDIENT_ROUTE_MODALS.barcodeScanner}`
				: listBasePath;
	}

	const query = params.toString();
	return `${nextUrl.pathname}${query ? `?${query}` : ""}${nextUrl.hash}`;
};

export const getCanonicalIngredientRouteHref = (url: URL) => {
	const nextUrl = new URL(url);
	const basePath = getIngredientRouteBasePath(url.pathname);
	const pathContext = getIngredientPathContext(url.pathname);
	const legacyTabKey = getListKeyFromRouteSlug(
		url.searchParams.get(LEGACY_LIST_TAB_PARAM),
	);
	let listKey = legacyTabKey ?? pathContext.listKey;
	let routeSegments = [...pathContext.routeSegments];

	if (
		["actions", "rename", INGREDIENT_ROUTE_SHEETS.imagePlacement].includes(
			routeSegments[0] ?? "",
		)
	) {
		const legacyItemListKey = getListKeyFromRouteSlug(routeSegments[1] ?? null);
		if (legacyItemListKey) {
			listKey = legacyItemListKey;
			routeSegments = [routeSegments[0], routeSegments[2]].filter(Boolean);
		}
	}

	if (
		routeSegments[0] === INGREDIENT_ROUTE_SHEETS.manualEntry &&
		routeSegments[1] === INGREDIENT_ROUTE_MODALS.barcodeScanner
	) {
		routeSegments = [INGREDIENT_ROUTE_MODALS.barcodeScanner];
	}

	nextUrl.pathname = [
		getIngredientListBasePath(basePath, listKey),
		...routeSegments,
	].filter(Boolean).join("/");
	nextUrl.searchParams.delete(LEGACY_LIST_TAB_PARAM);

	const currentHref = `${url.pathname}${url.search}`;
	const query = nextUrl.searchParams.toString();
	const canonicalHref = `${nextUrl.pathname}${query ? `?${query}` : ""}`;
	return canonicalHref === currentHref ? null : canonicalHref;
};

export const getIngredientRouteTitle = (
	url: URL,
	foodName?: string | null,
) => {
	const state = getIngredientRouteState(url);
	const namedFood = foodName?.trim();

	if (state.modal === INGREDIENT_ROUTE_MODALS.barcodeScanner) {
		return "Scan a Barcode";
	}
	if (state.view === INGREDIENT_ROUTE_VIEWS.search) {
		return "Search Ingredients";
	}
	if (state.view === INGREDIENT_ROUTE_VIEWS.nutrition) {
		return namedFood ? `${namedFood} Nutrition` : "Ingredient Nutrition";
	}
	if (state.sheet === INGREDIENT_ROUTE_SHEETS.manualEntry) {
		return "Add an Ingredient";
	}
	if (state.sheet === INGREDIENT_ROUTE_SHEETS.filters) {
		return "Filter & Sort Ingredients";
	}
	if (state.sheet === INGREDIENT_ROUTE_SHEETS.ingredientActions) {
		return namedFood ? `${namedFood} Actions` : "Ingredient Actions";
	}
	if (state.sheet === INGREDIENT_ROUTE_SHEETS.renameIngredient) {
		return namedFood ? `Rename ${namedFood}` : "Rename Ingredient";
	}
	if (state.sheet === INGREDIENT_ROUTE_SHEETS.imagePlacement) {
		return namedFood
			? `Adjust ${namedFood} Image`
			: "Adjust Ingredient Image";
	}
	return getIngredientListTab(url) === MIX_STORAGE_KEYS.shoppingList
		? "Shopping List"
		: "Fridge";
};

export const findIngredientRouteFood = (
	foodId: number | null,
	listKey: SmoothieListKey | null,
	fridgeItems: FdcFood[],
	shoppingListItems: FdcFood[],
	customItems: FdcFood[] = [],
) => {
	if (foodId === null) return null;
	const lists = listKey === MIX_STORAGE_KEYS.fridge
		? [fridgeItems, customItems]
		: listKey === MIX_STORAGE_KEYS.shoppingList
			? [shoppingListItems, customItems]
			: [fridgeItems, shoppingListItems, customItems];

	for (const list of lists) {
		const food = list.find((item) => item.fdcId === foodId);
		if (food) return food;
	}
	return null;
};
