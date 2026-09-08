import type { FoodNutrient } from "$lib/utils/food/types";

type ServingSource = FoodNutrient["source"] | string | undefined;

const EXTERNAL_PROVIDER_SOURCES = new Set<ServingSource>([
	"usda",
	"open-food-facts",
	"cola-cloud",
	"health-canada-cnf",
	"uk-cofid",
	"fsanz-afcd",
	"foodrepo",
]);

const UNIT_TRANSLATIONS = [
	["onzas fluidas", "fl oz"],
	["onza fluida", "fl oz"],
	["cucharaditas", "tsp"],
	["cucharadita", "tsp"],
	["cucharadas", "tbsp"],
	["cucharada", "tbsp"],
	["mililitros", "mL"],
	["mililitro", "mL"],
	["kilogramos", "kg"],
	["kilogramo", "kg"],
	["onzas", "oz"],
	["onza", "oz"],
	["onz", "oz"],
	["libras", "lb"],
	["libra", "lb"],
	["gramos", "g"],
	["gramo", "g"],
	["litros", "L"],
	["litro", "L"],
	["tazas", "cup"],
	["taza", "cup"],
] as const;

const escapeRegExp = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const UNIT_TRANSLATION_PATTERN = new RegExp(
	`(^|[^\\p{L}\\p{N}])(${UNIT_TRANSLATIONS.map(([source]) =>
		escapeRegExp(source),
	).join("|")})(?=$|[^\\p{L}\\p{N}])`,
	"giu",
);

const TRANSLATED_UNITS = new Map<string, string>(UNIT_TRANSLATIONS);

export const isExternalProviderServingSource = (source: ServingSource) =>
	EXTERNAL_PROVIDER_SOURCES.has(source);

/**
 * Canonicalizes only reviewed serving-unit vocabulary. Descriptive provider text is
 * intentionally preserved because translating arbitrary label copy would require a
 * language-aware service and could change the meaning of a source-reported serving.
 */
export const canonicalizeProviderServingLabel = (label: string) =>
	label
		.trim()
		.replace(
			UNIT_TRANSLATION_PATTERN,
			(_match, prefix, unit) =>
				`${prefix}${TRANSLATED_UNITS.get(unit.toLocaleLowerCase("en-US")) ?? unit}`,
		);

export const canonicalizeExternalProviderServingLabel = (
	label: string,
	source: ServingSource,
) =>
	isExternalProviderServingSource(source)
		? canonicalizeProviderServingLabel(label)
		: label.trim();
