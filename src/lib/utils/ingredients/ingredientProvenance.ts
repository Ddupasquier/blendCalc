import { getSupabaseBrowserClient } from "$lib/supabase/client";
import type { Database } from "$lib/types/database.types";
import type { FdcFood, FoodTrustStatus } from "$lib/utils/food/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type IngredientProvenanceDimension = "source" | "trust";
export type IngredientSourceKey =
	| "usda"
	| "open-food-facts"
	| "national-dataset"
	| "shared-catalog"
	| "custom";
export type IngredientTrustStatus = FoodTrustStatus;
export type IngredientBadgeTone = "info" | "success" | "custom" | "neutral";

export type IngredientProvenanceOption = Pick<
	Database["public"]["Tables"]["ingredient_provenance_options"]["Row"],
	| "dimension"
	| "value"
	| "filter_label"
	| "badge_label"
	| "badge_tone"
	| "display_order"
	| "filter_enabled"
	| "badge_enabled"
>;

export type IngredientBadgeDescriptor = {
	dimension: IngredientProvenanceDimension;
	value: string;
	label: string;
	tone: IngredientBadgeTone;
};

export type IngredientProvenanceFilters = {
	sourceFilter?: string;
	trustFilter?: string;
};

const SOURCE_KEYS = new Set<IngredientSourceKey>([
	"usda",
	"open-food-facts",
	"national-dataset",
	"shared-catalog",
	"custom",
]);
const TRUST_STATUSES = new Set<IngredientTrustStatus>([
	"source-verified",
	"imported",
	"corroborated",
	"moderator-reviewed",
	"pending-review",
	"user-private",
]);

export const isIngredientTrustStatus = (
	value: string | null | undefined,
): value is IngredientTrustStatus =>
	Boolean(value && TRUST_STATUSES.has(value as IngredientTrustStatus));

export const isIngredientSourceFilter = (value: string) =>
	value === "all" || SOURCE_KEYS.has(value as IngredientSourceKey);

export const isIngredientTrustFilter = (value: string) =>
	value === "any" || TRUST_STATUSES.has(value as IngredientTrustStatus);

export const getFoodSourceKey = (food: FdcFood): IngredientSourceKey => {
	const sourceKey = food.sourceKey === "fdc"
		? "usda"
		: food.sourceKey === "health-canada-cnf" ||
				food.sourceKey === "uk-cofid" ||
				food.sourceKey === "fsanz-afcd"
			? "national-dataset"
		: food.sourceKey === "community-reviewed" || food.sourceKey === "community"
			? "shared-catalog"
			: food.sourceKey;
	if (food.sharedProductId && (!sourceKey || sourceKey === "custom")) {
		return "shared-catalog";
	}
	if (sourceKey && SOURCE_KEYS.has(sourceKey as IngredientSourceKey)) {
		return sourceKey as IngredientSourceKey;
	}

	if (food.barcodeSource === "usda") return "usda";
	if (food.barcodeSource === "open-food-facts") return "open-food-facts";
	if (food.barcodeSource === "community") return "shared-catalog";
	if (food.customFood) return "custom";
	if (food.sharedProductId) return "shared-catalog";
	return "usda";
};

export const getFoodTrustStatus = (food: FdcFood): IngredientTrustStatus => {
	if (isIngredientTrustStatus(food.trustStatus)) return food.trustStatus;
	if (
		food.sharedProductId &&
		food.sharedProductConfidence &&
		TRUST_STATUSES.has(food.sharedProductConfidence as IngredientTrustStatus)
	) {
		return food.sharedProductConfidence as IngredientTrustStatus;
	}
	if (food.sharedProductId) {
		const sourceKey = getFoodSourceKey(food);
		if (sourceKey === "usda") return "source-verified";
		if (sourceKey === "open-food-facts") return "imported";
		return "moderator-reviewed";
	}
	if (food.customFood) return "user-private";

	const sourceKey = getFoodSourceKey(food);
	if (sourceKey === "usda") return "source-verified";
	if (sourceKey === "open-food-facts" || sourceKey === "national-dataset") {
		return "imported";
	}
	if (sourceKey === "shared-catalog") return "moderator-reviewed";
	return "user-private";
};

export const readIngredientProvenanceOptions = async (
	supabase: SupabaseClient<Database> | null = getSupabaseBrowserClient(),
): Promise<IngredientProvenanceOption[] | null> => {
	if (!supabase) return null;

	const { data, error } = await supabase
		.from("ingredient_provenance_options")
		.select(
			"dimension, value, filter_label, badge_label, badge_tone, display_order, filter_enabled, badge_enabled",
		)
		.order("dimension", { ascending: true })
		.order("display_order", { ascending: true });

	if (error) return null;
	return data ?? [];
};

export const getIngredientFilterOptions = (
	options: readonly IngredientProvenanceOption[],
	dimension: IngredientProvenanceDimension,
) =>
	options
		.filter((option) => option.dimension === dimension && option.filter_enabled)
		.map((option) => ({
			value: option.value,
			label: option.filter_label,
		}));

const getIngredientBadge = (
	food: FdcFood,
	options: readonly IngredientProvenanceOption[],
	dimension: IngredientProvenanceDimension,
): IngredientBadgeDescriptor | null => {
	const value = dimension === "source"
		? getFoodSourceKey(food)
		: getFoodTrustStatus(food);
	const option = options.find(
		(item) =>
			item.dimension === dimension &&
			item.value === value &&
			item.badge_enabled,
	);
	if (!option?.badge_label) return null;
	return {
		dimension,
		value: option.value,
		label: option.badge_label,
		tone: option.badge_tone as IngredientBadgeTone,
	};
};

export const getIngredientSourceBadge = (
	food: FdcFood,
	options: readonly IngredientProvenanceOption[],
) => getIngredientBadge(food, options, "source");

export const getIngredientTrustBadge = (
	food: FdcFood,
	options: readonly IngredientProvenanceOption[],
) => getIngredientBadge(food, options, "trust");

export const matchesIngredientProvenance = (
	food: FdcFood,
	sourceFilter = "all",
	trustFilter = "any",
) =>
	(sourceFilter === "all" || getFoodSourceKey(food) === sourceFilter) &&
	(trustFilter === "any" || getFoodTrustStatus(food) === trustFilter);
