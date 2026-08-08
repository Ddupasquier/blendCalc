import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { FoodItem } from "$lib/utils/food/types";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";

const ACTIONS_PARAM = "actions";
const LIST_ROUTE_SLUGS = {
	ingredients: "ingredients",
	fridge: "fridge",
	shoppingList: "shopping",
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
	catalogCorrection: "correct-information",
} as const;

export const INGREDIENT_ROUTE_MODALS = {
	barcodeScanner: "barcode-scanner",
	moveIngredient: "move-ingredient",
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
	listKey: IngredientListKey | null;
	showListActions: boolean;
};

export type IngredientRoutePatch = Partial<{
	view: IngredientRouteView | null;
	sheet: IngredientRouteSheet | null;
	modal: IngredientRouteModal | null;
	foodId: number | null;
	listKey: IngredientListKey | null;
	showListActions: boolean;
}>;

const parseFoodId = (value: string | null) => {
	if (!value) return null;
	const foodId = Number(value);
	return Number.isSafeInteger(foodId) ? foodId : null;
};

const getDecodedPathSegments = (pathname: string) =>
	pathname
		.split("/")
		.filter(Boolean)
		.map((segment) => decodeURIComponent(segment));

const getIngredientRoutePathSegments = (pathname: string) => {
	const segments = getDecodedPathSegments(pathname);
	return segments[0] === LIST_ROUTE_SLUGS.ingredients
		? segments.slice(1)
		: [];
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
		routeSegments:
			routeSegments[0] === LIST_ROUTE_SLUGS.fridge
				? routeSegments.slice(1)
				: [],
	};
};

const getIngredientListBasePath = (listKey: IngredientListKey) => {
	return listKey === MIX_STORAGE_KEYS.shoppingList
		? `/${LIST_ROUTE_SLUGS.ingredients}/${LIST_ROUTE_SLUGS.shoppingList}`
		: `/${LIST_ROUTE_SLUGS.ingredients}/${LIST_ROUTE_SLUGS.fridge}`;
};

export const getIngredientListTab = (url: URL): IngredientListKey => {
	return getIngredientPathContext(url.pathname).listKey;
};

export const buildIngredientListTabHref = (
	url: URL,
	key: IngredientListKey,
) => {
	const nextUrl = new URL(url);
	nextUrl.pathname = getIngredientListBasePath(key);
	nextUrl.searchParams.delete(ACTIONS_PARAM);
	const query = nextUrl.searchParams.toString();
	return `${nextUrl.pathname}${query ? `?${query}` : ""}${nextUrl.hash}`;
};

const getPathRouteState = (url: URL): IngredientRouteState | null => {
	const pathContext = getIngredientPathContext(url.pathname);
	const [routeSlug, secondSegment, ...remainingSegments] =
		pathContext.routeSegments;

	if (!routeSlug) return null;

	if (
		routeSlug === INGREDIENT_ROUTE_VIEWS.search &&
		(secondSegment === undefined ||
			(secondSegment === INGREDIENT_ROUTE_MODALS.barcodeScanner &&
				remainingSegments.length === 0))
	) {
		return {
			view: INGREDIENT_ROUTE_VIEWS.search,
			sheet:
				secondSegment === INGREDIENT_ROUTE_MODALS.barcodeScanner
					? INGREDIENT_ROUTE_SHEETS.manualEntry
					: null,
			modal:
				secondSegment === INGREDIENT_ROUTE_MODALS.barcodeScanner
					? INGREDIENT_ROUTE_MODALS.barcodeScanner
					: null,
			foodId: null,
			listKey: null,
			showListActions: true,
		};
	}

	if (
		routeSlug === INGREDIENT_ROUTE_VIEWS.nutrition &&
		parseFoodId(secondSegment ?? null) !== null &&
		remainingSegments.length === 0
	) {
		return {
			view: INGREDIENT_ROUTE_VIEWS.nutrition,
			sheet: null,
			modal: null,
			foodId: parseFoodId(secondSegment ?? null),
			listKey: pathContext.listKey,
			showListActions: url.searchParams.get(ACTIONS_PARAM) !== "hide",
		};
	}

	if (
		routeSlug === INGREDIENT_ROUTE_VIEWS.nutrition &&
		parseFoodId(secondSegment ?? null) !== null &&
		remainingSegments.length === 1 &&
		remainingSegments[0] === INGREDIENT_ROUTE_SHEETS.catalogCorrection
	) {
		return {
			view: INGREDIENT_ROUTE_VIEWS.nutrition,
			sheet: INGREDIENT_ROUTE_SHEETS.catalogCorrection,
			modal: null,
			foodId: parseFoodId(secondSegment ?? null),
			listKey: pathContext.listKey,
			showListActions: url.searchParams.get(ACTIONS_PARAM) !== "hide",
		};
	}

	if (
		routeSlug === INGREDIENT_ROUTE_SHEETS.manualEntry &&
		(secondSegment === undefined ||
			(secondSegment === INGREDIENT_ROUTE_MODALS.moveIngredient &&
				remainingSegments.length === 0))
	) {
		return {
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.manualEntry,
			modal:
				secondSegment === INGREDIENT_ROUTE_MODALS.moveIngredient
					? INGREDIENT_ROUTE_MODALS.moveIngredient
					: null,
			foodId: null,
			listKey: null,
			showListActions: true,
		};
	}

	if (
		routeSlug === INGREDIENT_ROUTE_SHEETS.filters &&
		secondSegment === undefined
	) {
		return {
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.filters,
			modal: null,
			foodId: null,
			listKey: null,
			showListActions: true,
		};
	}

	if (
		routeSlug === INGREDIENT_ROUTE_MODALS.barcodeScanner &&
		secondSegment === undefined
	) {
		return {
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.manualEntry,
			modal: INGREDIENT_ROUTE_MODALS.barcodeScanner,
			foodId: null,
			listKey: null,
			showListActions: true,
		};
	}

	if (
		routeSlug === "actions" &&
		parseFoodId(secondSegment ?? null) !== null &&
		remainingSegments.length === 0
	) {
		return {
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.ingredientActions,
			modal: null,
			foodId: parseFoodId(secondSegment ?? null),
			listKey: pathContext.listKey,
			showListActions: true,
		};
	}

	if (
		routeSlug === "rename" &&
		parseFoodId(secondSegment ?? null) !== null &&
		remainingSegments.length === 0
	) {
		return {
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.renameIngredient,
			modal: null,
			foodId: parseFoodId(secondSegment ?? null),
			listKey: pathContext.listKey,
			showListActions: true,
		};
	}

	if (
		routeSlug === INGREDIENT_ROUTE_SHEETS.imagePlacement &&
		parseFoodId(secondSegment ?? null) !== null &&
		remainingSegments.length === 0
	) {
		return {
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.imagePlacement,
			modal: null,
			foodId: parseFoodId(secondSegment ?? null),
			listKey: pathContext.listKey,
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
	const listBasePath = getIngredientListBasePath(routeListKey);
	const nextShowListActions =
		patch.showListActions !== undefined
			? patch.showListActions
			: current.showListActions;

	params.delete(ACTIONS_PARAM);

	if (nextView) {
		nextUrl.pathname =
			nextView === INGREDIENT_ROUTE_VIEWS.nutrition &&
				nextSheet === INGREDIENT_ROUTE_SHEETS.catalogCorrection
				? `${listBasePath}/${INGREDIENT_ROUTE_VIEWS.nutrition}/${nextFoodId ?? ""}/${INGREDIENT_ROUTE_SHEETS.catalogCorrection}`
				: nextView === INGREDIENT_ROUTE_VIEWS.search
					? nextModal === INGREDIENT_ROUTE_MODALS.barcodeScanner
						? `${listBasePath}/${INGREDIENT_ROUTE_VIEWS.search}/${INGREDIENT_ROUTE_MODALS.barcodeScanner}`
						: `${listBasePath}/${INGREDIENT_ROUTE_VIEWS.search}`
				: `${listBasePath}/${INGREDIENT_ROUTE_VIEWS.nutrition}/${nextFoodId ?? ""}`;
		if (nextView === INGREDIENT_ROUTE_VIEWS.nutrition) {
			if (!nextShowListActions) params.set(ACTIONS_PARAM, "hide");
		}
	} else if (nextSheet) {
		if (nextModal === INGREDIENT_ROUTE_MODALS.barcodeScanner) {
			nextUrl.pathname = `${listBasePath}/${INGREDIENT_ROUTE_MODALS.barcodeScanner}`;
		} else if (nextModal === INGREDIENT_ROUTE_MODALS.moveIngredient) {
			nextUrl.pathname = `${listBasePath}/${INGREDIENT_ROUTE_SHEETS.manualEntry}/${INGREDIENT_ROUTE_MODALS.moveIngredient}`;
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

export const getBarcodeScannerOpenRoutePatch = (
	url: URL,
): IngredientRoutePatch => {
	const preserveSearch =
		getIngredientRouteState(url).view === INGREDIENT_ROUTE_VIEWS.search;

	return {
		view: preserveSearch ? INGREDIENT_ROUTE_VIEWS.search : null,
		sheet: INGREDIENT_ROUTE_SHEETS.manualEntry,
		modal: INGREDIENT_ROUTE_MODALS.barcodeScanner,
		foodId: null,
		listKey: null,
	};
};

export const getBarcodeScannerCloseRoutePatch = (
	url: URL,
): IngredientRoutePatch => {
	const restoreSearch =
		getIngredientRouteState(url).view === INGREDIENT_ROUTE_VIEWS.search;

	return {
		view: restoreSearch ? INGREDIENT_ROUTE_VIEWS.search : null,
		sheet: restoreSearch ? null : INGREDIENT_ROUTE_SHEETS.manualEntry,
		modal: null,
		foodId: null,
		listKey: null,
	};
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
	if (state.modal === INGREDIENT_ROUTE_MODALS.moveIngredient) {
		return "Move Ingredient";
	}
	if (state.view === INGREDIENT_ROUTE_VIEWS.search) {
		return "Search Ingredients";
	}
	if (state.view === INGREDIENT_ROUTE_VIEWS.nutrition) {
		if (state.sheet === INGREDIENT_ROUTE_SHEETS.catalogCorrection) {
			return namedFood
				? `Correct ${namedFood}`
				: "Correct Product Information";
		}
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
	listKey: IngredientListKey | null,
	fridgeItems: FoodItem[],
	shoppingListItems: FoodItem[],
	customItems: FoodItem[] = [],
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
