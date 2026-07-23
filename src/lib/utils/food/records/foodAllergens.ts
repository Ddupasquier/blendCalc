import type { FdcFood, FoodCompatibilitySummary } from "$lib/utils/food/types";

export type FoodAllergenDisplay = {
	contains: string[];
	mayContain: string[];
};

const normalizeAllergenLabel = (value: string) =>
	value
		.trim()
		.replace(/^[a-z]{2}:/i, "")
		.replace(/[-_]+/g, " ")
		.replace(/\s+/g, " ");

const formatAllergenLabel = (value: string) => {
	const normalized = normalizeAllergenLabel(value);
	return normalized
		? `${normalized.charAt(0).toLocaleUpperCase()}${normalized.slice(1)}`
		: "";
};

const uniqueAllergenLabels = (values: Array<string | null | undefined>) => {
	const seen = new Set<string>();
	return values.flatMap((value) => {
		const label = formatAllergenLabel(value ?? "");
		const key = label.toLocaleLowerCase();
		if (!label || seen.has(key)) return [];
		seen.add(key);
		return [label];
	});
};

const getAllergenFacts = (
	summary: FoodCompatibilitySummary | undefined,
	factType: "contains" | "may_contain",
) => [
	...(summary?.allFacts ?? []),
	...(factType === "contains"
		? summary?.contains ?? []
		: summary?.mayContain ?? []),
].filter(
	(fact) => fact.category === "allergen" && fact.factType === factType,
);

export const getFoodAllergenDisplay = (food: FdcFood): FoodAllergenDisplay => {
	const contains = uniqueAllergenLabels([
		...(food.allergens ?? []),
		...getAllergenFacts(food.compatibilitySummary, "contains")
			.map((fact) => fact.label || fact.sourceText),
	]);
	const containsKeys = new Set(
		contains.map((label) => label.toLocaleLowerCase()),
	);
	const mayContain = uniqueAllergenLabels([
		...(food.traces ?? []),
		...getAllergenFacts(food.compatibilitySummary, "may_contain")
			.map((fact) => fact.label || fact.sourceText),
	]).filter((label) => !containsKeys.has(label.toLocaleLowerCase()));

	return { contains, mayContain };
};
