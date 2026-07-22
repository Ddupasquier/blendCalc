import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { FdcFood } from "$lib/utils/food/types";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

const VIEW_PARAM = "view";
const SHEET_PARAM = "sheet";
const MODAL_PARAM = "modal";
const FOOD_PARAM = "food";
const LIST_PARAM = "list";
const ACTIONS_PARAM = "actions";
const LIST_TAB_PARAM = "tab";
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

const routeViews = new Set<string>(Object.values(INGREDIENT_ROUTE_VIEWS));
const routeSheets = new Set<string>(Object.values(INGREDIENT_ROUTE_SHEETS));
const routeModals = new Set<string>(Object.values(INGREDIENT_ROUTE_MODALS));

export const isIngredientListKey = (
	value: string | null,
): value is SmoothieListKey =>
	value === MIX_STORAGE_KEYS.fridge || value === MIX_STORAGE_KEYS.shoppingList;

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

export const getIngredientListTab = (url: URL): SmoothieListKey =>
	getListKeyFromRouteSlug(url.searchParams.get(LIST_TAB_PARAM)) ??
	MIX_STORAGE_KEYS.fridge;

export const buildIngredientListTabHref = (
	url: URL,
	key: SmoothieListKey,
) => {
	const nextUrl = new URL(url);
	if (key === MIX_STORAGE_KEYS.fridge) {
		nextUrl.searchParams.delete(LIST_TAB_PARAM);
	} else {
		nextUrl.searchParams.set(
			LIST_TAB_PARAM,
			getRouteSlugFromListKey(key) ?? LIST_ROUTE_SLUGS.shoppingList,
		);
	}
	const query = nextUrl.searchParams.toString();
	return `${nextUrl.pathname}${query ? `?${query}` : ""}${nextUrl.hash}`;
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

const getPathRouteState = (url: URL): IngredientRouteState | null => {
	const [routeSlug, secondSegment, thirdSegment] = getIngredientRoutePathSegments(
		url.pathname,
	);

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
			listKey: null,
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
		return {
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.ingredientActions,
			modal: null,
			foodId: parseFoodId(thirdSegment ?? null),
			listKey: getListKeyFromRouteSlug(secondSegment ?? null),
			showListActions: true,
		};
	}

	if (routeSlug === "rename") {
		return {
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.renameIngredient,
			modal: null,
			foodId: parseFoodId(thirdSegment ?? null),
			listKey: getListKeyFromRouteSlug(secondSegment ?? null),
			showListActions: true,
		};
	}

	if (routeSlug === INGREDIENT_ROUTE_SHEETS.imagePlacement) {
		return {
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.imagePlacement,
			modal: null,
			foodId: parseFoodId(thirdSegment ?? null),
			listKey: getListKeyFromRouteSlug(secondSegment ?? null),
			showListActions: true,
		};
	}

	return null;
};

export const getIngredientRouteState = (url: URL): IngredientRouteState => {
	const pathState = getPathRouteState(url);
	if (pathState) return pathState;

	const viewParam = url.searchParams.get(VIEW_PARAM);
	const sheetParam = url.searchParams.get(SHEET_PARAM);
	const modalParam = url.searchParams.get(MODAL_PARAM);
	const view = routeViews.has(viewParam ?? "")
		? (viewParam as IngredientRouteView)
		: null;
	const sheet = routeSheets.has(sheetParam ?? "")
		? (sheetParam as IngredientRouteSheet)
		: null;
	const modal = routeModals.has(modalParam ?? "")
		? (modalParam as IngredientRouteModal)
		: null;

	return {
		view,
		sheet: view ? null : sheet,
		modal,
		foodId: parseFoodId(url.searchParams.get(FOOD_PARAM)),
		listKey: getListKeyFromRouteSlug(url.searchParams.get(LIST_PARAM)),
		showListActions: url.searchParams.get(ACTIONS_PARAM) !== "hide",
	};
};

export const buildIngredientRouteHref = (
	url: URL,
	patch: IngredientRoutePatch = {},
) => {
	const nextUrl = new URL(url);
	const basePath = getIngredientRouteBasePath(url.pathname);
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
	const nextShowListActions =
		patch.showListActions !== undefined
			? patch.showListActions
			: current.showListActions;

	params.delete(VIEW_PARAM);
	params.delete(SHEET_PARAM);
	params.delete(MODAL_PARAM);
	params.delete(FOOD_PARAM);
	params.delete(LIST_PARAM);
	params.delete(ACTIONS_PARAM);

	if (nextView) {
		nextUrl.pathname =
			nextView === INGREDIENT_ROUTE_VIEWS.search
				? `${basePath}/${INGREDIENT_ROUTE_VIEWS.search}`
				: `${basePath}/${INGREDIENT_ROUTE_VIEWS.nutrition}/${nextFoodId ?? ""}`;
		if (nextView === INGREDIENT_ROUTE_VIEWS.nutrition) {
			if (!nextShowListActions) params.set(ACTIONS_PARAM, "hide");
		}
	} else if (nextSheet) {
		const listSlug = getRouteSlugFromListKey(nextListKey);
		if (nextModal === INGREDIENT_ROUTE_MODALS.barcodeScanner) {
			nextUrl.pathname = `${basePath}/${INGREDIENT_ROUTE_SHEETS.manualEntry}/${INGREDIENT_ROUTE_MODALS.barcodeScanner}`;
		} else if (nextSheet === INGREDIENT_ROUTE_SHEETS.manualEntry) {
			nextUrl.pathname = `${basePath}/${INGREDIENT_ROUTE_SHEETS.manualEntry}`;
		} else if (nextSheet === INGREDIENT_ROUTE_SHEETS.filters) {
			nextUrl.pathname = `${basePath}/${INGREDIENT_ROUTE_SHEETS.filters}`;
		} else if (nextSheet === INGREDIENT_ROUTE_SHEETS.ingredientActions) {
			nextUrl.pathname = `${basePath}/actions/${listSlug ?? ""}/${nextFoodId ?? ""}`;
		} else if (nextSheet === INGREDIENT_ROUTE_SHEETS.renameIngredient) {
			nextUrl.pathname = `${basePath}/rename/${listSlug ?? ""}/${nextFoodId ?? ""}`;
		} else if (nextSheet === INGREDIENT_ROUTE_SHEETS.imagePlacement) {
			nextUrl.pathname = `${basePath}/${INGREDIENT_ROUTE_SHEETS.imagePlacement}/${listSlug ?? ""}/${nextFoodId ?? ""}`;
		}
	} else {
		nextUrl.pathname =
			nextModal === INGREDIENT_ROUTE_MODALS.barcodeScanner
				? `${basePath}/${INGREDIENT_ROUTE_SHEETS.manualEntry}/${INGREDIENT_ROUTE_MODALS.barcodeScanner}`
				: basePath;
	}

	const query = params.toString();
	return `${nextUrl.pathname}${query ? `?${query}` : ""}${nextUrl.hash}`;
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
