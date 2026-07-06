import { MIX_STORAGE_KEYS } from "../../../defaults/mixDefaults";
import type { FdcFood } from "$lib/utils/food/types";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

const VIEW_PARAM = "view";
const SHEET_PARAM = "sheet";
const FOOD_PARAM = "food";
const LIST_PARAM = "list";
const ACTIONS_PARAM = "actions";
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
	renameIngredient: "rename-ingredient",
} as const;

export type IngredientRouteView =
	(typeof INGREDIENT_ROUTE_VIEWS)[keyof typeof INGREDIENT_ROUTE_VIEWS];

export type IngredientRouteSheet =
	(typeof INGREDIENT_ROUTE_SHEETS)[keyof typeof INGREDIENT_ROUTE_SHEETS];

export type IngredientRouteState = {
	view: IngredientRouteView | null;
	sheet: IngredientRouteSheet | null;
	foodId: number | null;
	listKey: SmoothieListKey | null;
	showListActions: boolean;
};

export type IngredientRoutePatch = Partial<{
	view: IngredientRouteView | null;
	sheet: IngredientRouteSheet | null;
	foodId: number | null;
	listKey: SmoothieListKey | null;
	showListActions: boolean;
}>;

const routeViews = new Set<string>(Object.values(INGREDIENT_ROUTE_VIEWS));
const routeSheets = new Set<string>(Object.values(INGREDIENT_ROUTE_SHEETS));

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

const parseFoodId = (value: string | null) => {
	if (!value) return null;
	const foodId = Number(value);
	return Number.isFinite(foodId) ? foodId : null;
};

const setOrDelete = (
	params: URLSearchParams,
	key: string,
	value: string | number | null | undefined,
) => {
	if (value === null || value === undefined || value === "") {
		params.delete(key);
		return;
	}
	params.set(key, String(value));
};

export const getIngredientRouteState = (url: URL): IngredientRouteState => {
	const viewParam = url.searchParams.get(VIEW_PARAM);
	const sheetParam = url.searchParams.get(SHEET_PARAM);
	const view = routeViews.has(viewParam ?? "")
		? (viewParam as IngredientRouteView)
		: null;
	const sheet = routeSheets.has(sheetParam ?? "")
		? (sheetParam as IngredientRouteSheet)
		: null;

	return {
		view,
		sheet: view ? null : sheet,
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
	const params = nextUrl.searchParams;
	const current = getIngredientRouteState(url);
	const nextView = patch.view !== undefined ? patch.view : current.view;
	const nextSheet = patch.sheet !== undefined ? patch.sheet : current.sheet;
	const nextFoodId = patch.foodId !== undefined ? patch.foodId : current.foodId;
	const nextListKey = patch.listKey !== undefined ? patch.listKey : current.listKey;
	const nextShowListActions =
		patch.showListActions !== undefined
			? patch.showListActions
			: current.showListActions;

	params.delete(VIEW_PARAM);
	params.delete(SHEET_PARAM);
	params.delete(FOOD_PARAM);
	params.delete(LIST_PARAM);
	params.delete(ACTIONS_PARAM);

	if (nextView) {
		params.set(VIEW_PARAM, nextView);
		if (nextView === INGREDIENT_ROUTE_VIEWS.nutrition) {
			setOrDelete(params, FOOD_PARAM, nextFoodId);
			if (!nextShowListActions) params.set(ACTIONS_PARAM, "hide");
		}
	} else if (nextSheet) {
		params.set(SHEET_PARAM, nextSheet);
		if (
			nextSheet === INGREDIENT_ROUTE_SHEETS.ingredientActions ||
			nextSheet === INGREDIENT_ROUTE_SHEETS.renameIngredient
		) {
			setOrDelete(params, FOOD_PARAM, nextFoodId);
			setOrDelete(params, LIST_PARAM, getRouteSlugFromListKey(nextListKey));
		}
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
