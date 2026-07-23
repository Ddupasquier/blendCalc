import { getSupabaseBrowserClient } from "$lib/supabase/client";
import type { Database } from "$lib/types/database.types";
import type { FdcFood, FoodTrustStatus } from "$lib/utils/food/types";
import { isPrivateCustomFood } from "$lib/utils/food/records/foodClassification";
import type { SupabaseClient } from "@supabase/supabase-js";

export type IngredientProvenanceDimension = "source" | "trust";
export type IngredientSourceKey =
	| "usda"
	| "open-food-facts"
	| "national-dataset"
	| "shared-catalog"
	| "custom"
	| "unknown";
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
	"unknown",
]);
const TRUST_STATUSES = new Set<IngredientTrustStatus>([
	"source-verified",
	"imported",
	"corroborated",
	"moderator-reviewed",
	"pending-review",
	"unverified",
	"user-private",
]);

const VERIFIED_EVIDENCE_STATUSES = new Set<IngredientTrustStatus>([
	"source-verified",
	"corroborated",
	"moderator-reviewed",
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
	if (isPrivateCustomFood(food)) return "custom";
	if (food.sharedProductId) return "shared-catalog";
	return "unknown";
};

export const getFoodTrustStatus = (food: FdcFood): IngredientTrustStatus => {
	if (isIngredientTrustStatus(food.trustStatus)) {
		return food.trustStatus === "imported" ? "unverified" : food.trustStatus;
	}
	if (
		food.sharedProductConfidence &&
		TRUST_STATUSES.has(food.sharedProductConfidence as IngredientTrustStatus)
	) {
		return food.sharedProductConfidence === "imported"
			? "unverified"
			: food.sharedProductConfidence as IngredientTrustStatus;
	}
	if (isPrivateCustomFood(food)) return "user-private";
	return "unverified";
};

export const isFoodVerified = (food: FdcFood) =>
	VERIFIED_EVIDENCE_STATUSES.has(getFoodTrustStatus(food));

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

export const getIngredientTrustBadge = (
	food: FdcFood,
	options: readonly IngredientProvenanceOption[],
) => {
	const trustStatus = getFoodTrustStatus(food);
	if (VERIFIED_EVIDENCE_STATUSES.has(trustStatus)) {
		const verifiedOption = options.find(
			(option) =>
				option.dimension === "trust" &&
				option.value === "source-verified" &&
				option.badge_enabled,
		);
		if (!verifiedOption?.badge_label) return null;
		return {
			dimension: "trust" as const,
			value: "verified",
			label: verifiedOption.badge_label,
			tone: verifiedOption.badge_tone as IngredientBadgeTone,
		};
	}
	if (trustStatus !== "pending-review") return null;
	const pendingOption = options.find(
		(option) =>
			option.dimension === "trust" &&
			option.value === trustStatus &&
			option.badge_enabled,
	);
	if (!pendingOption?.badge_label) return null;
	return {
		dimension: "trust" as const,
		value: trustStatus,
		label: pendingOption.badge_label,
		tone: pendingOption.badge_tone as IngredientBadgeTone,
	};
};

export const matchesIngredientProvenance = (
	food: FdcFood,
	sourceFilter = "all",
	trustFilter = "any",
) =>
	(sourceFilter === "all" || getFoodSourceKey(food) === sourceFilter) &&
	(trustFilter === "any" || getFoodTrustStatus(food) === trustFilter);
