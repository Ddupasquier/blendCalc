export const MIX_ROUTE_OVERLAYS = {
	options: "options",
	reorganize: "reorganize",
	ingredientFilters: "ingredient-filters",
	save: "save",
	resetGoals: "reset-goals",
	clearIngredients: "clear-ingredients",
	resetAll: "reset-all",
	warningDetails: "warning-details",
	conversionDetails: "conversion-details",
  saveGoalPreset: "save-goal-preset",
  deleteGoalPreset: "delete-goal-preset",
} as const;

export type MixRouteOverlay =
	(typeof MIX_ROUTE_OVERLAYS)[keyof typeof MIX_ROUTE_OVERLAYS];

export type MixRouteState = {
	overlay: MixRouteOverlay | null;
	foodId: number | null;
	warningId: string | null;
  goalTemplateId: string | null;
};

export type MixRouteTarget =
	| { overlay: null }
	| { overlay: typeof MIX_ROUTE_OVERLAYS.options }
	| { overlay: typeof MIX_ROUTE_OVERLAYS.reorganize }
	| { overlay: typeof MIX_ROUTE_OVERLAYS.ingredientFilters }
	| { overlay: typeof MIX_ROUTE_OVERLAYS.save }
	| { overlay: typeof MIX_ROUTE_OVERLAYS.resetGoals }
	| { overlay: typeof MIX_ROUTE_OVERLAYS.clearIngredients }
	| { overlay: typeof MIX_ROUTE_OVERLAYS.resetAll }
	| {
			overlay: typeof MIX_ROUTE_OVERLAYS.warningDetails;
			warningId: string;
	  }
	| {
			overlay: typeof MIX_ROUTE_OVERLAYS.conversionDetails;
			foodId: number;
    }
  | { overlay: typeof MIX_ROUTE_OVERLAYS.saveGoalPreset }
  | {
      overlay: typeof MIX_ROUTE_OVERLAYS.deleteGoalPreset;
      goalTemplateId: string;
	  };

const EMPTY_MIX_ROUTE_STATE: MixRouteState = {
	overlay: null,
	foodId: null,
	warningId: null,
  goalTemplateId: null,
};

const parseFoodId = (value: string | undefined) => {
	if (value === undefined || !/^-?\d+$/.test(value)) return null;
	const foodId = Number(value);
	return Number.isSafeInteger(foodId) ? foodId : null;
};

const getSegments = (pathname: string) =>
	pathname
		.split("/")
		.filter(Boolean)
		.map((segment) => decodeURIComponent(segment));

export const getActiveMixRouteHref = (url: URL, shallowRouteHref?: string) =>
	shallowRouteHref ?? `${url.pathname}${url.search}${url.hash}`;

export const getActiveMixRouteState = (url: URL, shallowRouteHref?: string) =>
  getMixRouteState(new URL(getActiveMixRouteHref(url, shallowRouteHref), url));

export const getMixRouteState = (url: URL): MixRouteState => {
  const segments = getSegments(url.pathname);
  const [root, first, second, third, fourth] = segments;
  if (root !== "mix") return EMPTY_MIX_ROUTE_STATE;
	if (first === undefined) return EMPTY_MIX_ROUTE_STATE;
	if (first === MIX_ROUTE_OVERLAYS.options && second === undefined) {
		return { ...EMPTY_MIX_ROUTE_STATE, overlay: MIX_ROUTE_OVERLAYS.options };
	}
	if (first === MIX_ROUTE_OVERLAYS.reorganize && second === undefined) {
		return {
			...EMPTY_MIX_ROUTE_STATE,
			overlay: MIX_ROUTE_OVERLAYS.reorganize,
		};
	}
  if (first === "ingredients" && second === "filters" && third === undefined) {
		return {
			...EMPTY_MIX_ROUTE_STATE,
			overlay: MIX_ROUTE_OVERLAYS.ingredientFilters,
		};
	}

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
    third === MIX_ROUTE_OVERLAYS.conversionDetails &&
    segments.length === 4
	) {
		return {
			...EMPTY_MIX_ROUTE_STATE,
			overlay: MIX_ROUTE_OVERLAYS.conversionDetails,
			foodId: parseFoodId(second),
		};
	}
  if (
    first === "goals" &&
    second === "presets" &&
    third === "save" &&
    segments.length === 4
  ) {
    return {
      ...EMPTY_MIX_ROUTE_STATE,
      overlay: MIX_ROUTE_OVERLAYS.saveGoalPreset,
    };
  }
  if (
    first === "goals" &&
    second === "presets" &&
    third &&
    fourth === "delete" &&
    segments.length === 5
  ) {
    return {
      ...EMPTY_MIX_ROUTE_STATE,
      overlay: MIX_ROUTE_OVERLAYS.deleteGoalPreset,
      goalTemplateId: third,
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
		case MIX_ROUTE_OVERLAYS.options:
		case MIX_ROUTE_OVERLAYS.reorganize:
		case MIX_ROUTE_OVERLAYS.save:
		case MIX_ROUTE_OVERLAYS.resetGoals:
		case MIX_ROUTE_OVERLAYS.clearIngredients:
		case MIX_ROUTE_OVERLAYS.resetAll:
			nextUrl.pathname = `/mix/${target.overlay}`;
			break;
		case MIX_ROUTE_OVERLAYS.ingredientFilters:
			nextUrl.pathname = "/mix/ingredients/filters";
			break;
		case MIX_ROUTE_OVERLAYS.warningDetails:
			nextUrl.pathname = `/mix/warnings/${encodeURIComponent(target.warningId)}`;
			break;
		case MIX_ROUTE_OVERLAYS.conversionDetails:
			nextUrl.pathname = `/mix/ingredients/${target.foodId}/${MIX_ROUTE_OVERLAYS.conversionDetails}`;
			break;
    case MIX_ROUTE_OVERLAYS.saveGoalPreset:
      nextUrl.pathname = "/mix/goals/presets/save";
      break;
    case MIX_ROUTE_OVERLAYS.deleteGoalPreset:
      nextUrl.pathname = `/mix/goals/presets/${encodeURIComponent(target.goalTemplateId)}/delete`;
      break;
	}

	const query = nextUrl.searchParams.toString();
	return `${nextUrl.pathname}${query ? `?${query}` : ""}${nextUrl.hash}`;
};

export const getMixRouteTitle = (url: URL) => {
	const state = getMixRouteState(url);
	switch (state.overlay) {
		case MIX_ROUTE_OVERLAYS.options:
			return "Mix Options";
		case MIX_ROUTE_OVERLAYS.reorganize:
			return "Reorganize Mix";
		case MIX_ROUTE_OVERLAYS.ingredientFilters:
			return "Filter Mix Ingredients";
		case MIX_ROUTE_OVERLAYS.save:
			return "Save Mix";
		case MIX_ROUTE_OVERLAYS.resetGoals:
			return "Reset Nutrition Goals";
		case MIX_ROUTE_OVERLAYS.clearIngredients:
			return "Clear Mix Ingredients";
		case MIX_ROUTE_OVERLAYS.resetAll:
			return "Reset Mix";
		case MIX_ROUTE_OVERLAYS.warningDetails:
			return "Mix Warning Details";
		case MIX_ROUTE_OVERLAYS.conversionDetails:
			return "Serving Conversion Details";
    case MIX_ROUTE_OVERLAYS.saveGoalPreset:
      return "Save Goal Preset";
    case MIX_ROUTE_OVERLAYS.deleteGoalPreset:
      return "Delete Goal Preset";
		default:
			return "Mix";
	}
};
