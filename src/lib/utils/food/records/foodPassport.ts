import type { FoodItem, FoodTrustStatus } from "$lib/utils/food/types";

export type FoodPassportAvailabilityRow = {
	label: string;
	value: string;
	available: boolean;
};

export type FoodPassportHistoryRow = {
	label: string;
	value: string;
};

export type FoodPassportPresentation = {
	statusLabel: string;
	summary: string;
	historyRows: FoodPassportHistoryRow[];
	availabilityRows: FoodPassportAvailabilityRow[];
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
	year: "numeric",
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

const formatDate = (value: string | undefined) => {
	if (!value) return "";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date);
};

const VERIFIED_TRUST_STATUSES = new Set<FoodTrustStatus>([
	"source-verified",
	"corroborated",
	"moderator-reviewed",
]);

const getPassportIdentity = (food: FoodItem) => {
	if (food.trustStatus === "pending-review") {
		return {
			statusLabel: "Review pending",
			summary:
				"An update to this shared food is waiting for review. The current accepted record remains in use.",
		};
	}
	if (
		food.sharedProductId &&
		food.trustStatus &&
		VERIFIED_TRUST_STATUSES.has(food.trustStatus)
	) {
		return {
			statusLabel: "Verified",
			summary:
				"This shared food has accepted evidence and can keep evolving when its package or source information changes.",
		};
	}
	if (food.sharedProductId) {
		return {
			statusLabel: "Shared record",
			summary:
				"This food is part of the shared catalog. Some details may still need stronger or newer evidence.",
		};
	}
	if (
		food.foodIdentityType === "private-custom" ||
		food.trustStatus === "user-private"
	) {
		return {
			statusLabel: "Personal",
			summary:
				"This food belongs only to your account and is not part of the shared catalog.",
		};
	}
	if (food.sourceKey || food.sourceLabel || food.sourceAttribution) {
		return {
			statusLabel: "Source record",
			summary:
				"This food comes from a source record that may not include every package detail.",
		};
	}
	return {
		statusLabel: "Unverified",
		summary: "This food does not yet have a verified shared record.",
	};
};

const getHistoryRows = (food: FoodItem): FoodPassportHistoryRow[] => {
	const metadata = food.canonicalCatalogMetadata;
	if (!metadata) return [];
	const revisionNumber = metadata.currentRevisionNumber;
	return [
		{
			label: "Last checked",
			value: formatDate(metadata.lastVerifiedAt),
		},
		{
			label: "Current revision",
			value: Number.isSafeInteger(revisionNumber)
				? `Revision ${revisionNumber}`
				: "",
		},
		{
			label: "Current label observed",
			value: formatDate(metadata.currentLabelObservedAt),
		},
		{
			label: "Shared since",
			value: formatDate(metadata.recordCreatedAt),
		},
	].filter((row) => row.value);
};

const getReportedNutrientCount = (food: FoodItem) => {
	if (food.reportedNutrientIds?.length) {
		return new Set(food.reportedNutrientIds).size;
	}
	return food.foodNutrients.filter((nutrient) =>
		Number.isFinite(nutrient.value),
	).length;
};

const getServingCount = (food: FoodItem) =>
	(food.foodServings ?? []).filter(
		(serving) => Number.isFinite(serving.gramWeight) && serving.gramWeight > 0,
	).length;

const hasIngredientInformation = (food: FoodItem) =>
	Boolean(food.ingredients?.trim()) ||
	Boolean(food.ingredientList?.length) ||
	Boolean(food.structuredIngredients?.length);

const getPackageSafetyAvailability = (food: FoodItem) => {
	const hasContains = Boolean(
		food.allergenDisclosure?.contains.length || food.allergens?.length,
	);
	const hasPrecautionary = Boolean(
		food.allergenDisclosure?.mayContain.length ||
		food.traces?.length ||
		food.precautionaryStatements?.length,
	);
	if (hasContains && hasPrecautionary)
		return "Contains and precautionary details available";
	if (hasContains) return "Contains details available";
	if (hasPrecautionary) return "Precautionary details available";
	return food.foodIdentityType === "generic"
		? "Package labels do not apply"
		: "Not provided";
};

const getAvailabilityRows = (food: FoodItem): FoodPassportAvailabilityRow[] => {
	const nutrientCount = getReportedNutrientCount(food);
	const nutrientCountLabel = food.reportedNutrientIds?.length
		? `${nutrientCount} reported nutrient value${nutrientCount === 1 ? "" : "s"}`
		: `${nutrientCount} nutrient value${nutrientCount === 1 ? "" : "s"} available`;
	const servingCount = getServingCount(food);
	const hasIngredients = hasIngredientInformation(food);
	const packageSafety = getPackageSafetyAvailability(food);
	const hasPackageSafety = packageSafety !== "Not provided";
	const fieldSourceCount = Object.values(food.fieldProvenance ?? {}).filter(
		Boolean,
	).length;

	return [
		{
			label: "Nutrition",
			value: nutrientCount > 0 ? nutrientCountLabel : "Not provided",
			available: nutrientCount > 0,
		},
		{
			label: "Servings",
			value:
				servingCount > 0
					? `${servingCount} serving option${servingCount === 1 ? "" : "s"}`
					: "Not provided",
			available: servingCount > 0,
		},
		{
			label: "Ingredients",
			value: hasIngredients
				? "Ingredient information available"
				: "Not provided",
			available: hasIngredients,
		},
		{
			label: "Package safety",
			value: packageSafety,
			available: hasPackageSafety,
		},
		{
			label: "Product image",
			value: food.image?.imageUrl ? "Image available" : "Not provided",
			available: Boolean(food.image?.imageUrl),
		},
		{
			label: "Field history",
			value:
				fieldSourceCount > 0
					? `${fieldSourceCount} field source${fieldSourceCount === 1 ? "" : "s"} recorded`
					: "Not provided",
			available: fieldSourceCount > 0,
		},
	];
};

export const getFoodPassportPresentation = (
	food: FoodItem,
): FoodPassportPresentation => ({
	...getPassportIdentity(food),
	historyRows: getHistoryRows(food),
	availabilityRows: getAvailabilityRows(food),
});
