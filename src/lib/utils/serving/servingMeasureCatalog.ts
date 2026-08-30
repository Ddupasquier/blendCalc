export type ServingMeasureUnit = string;

export type ServingMeasureDimension = "weight" | "volume" | "count";

export type ServingMeasureOption = {
	value: ServingMeasureUnit;
	label: string;
	shortLabel: string;
	dimension: ServingMeasureDimension;
	conversionToBase: number;
	isDefault: boolean;
};

export type ServingMeasureCatalog = {
	options: ServingMeasureOption[];
	aliases: Record<string, ServingMeasureUnit>;
	aliasEntries: Array<{ alias: string; unit: ServingMeasureUnit }>;
};

export const SERVING_MEASURE_OPTIONS: ServingMeasureOption[] = [];

export const SERVING_MEASURE_ALIASES: Record<string, ServingMeasureUnit> = {};

export const SERVING_MEASURE_ALIAS_ENTRIES: Array<{
	alias: string;
	unit: ServingMeasureUnit;
}> = [];

export const DEFAULT_GRAMS_PER_WEIGHT_MEASURE: Record<
	ServingMeasureUnit,
	number
> = {};

export const DEFAULT_MILLILITERS_PER_VOLUME_MEASURE: Record<
	ServingMeasureUnit,
	number
> = {};

const replaceRecord = <Value>(
	target: Record<string, Value>,
	values: Record<string, Value>,
) => {
	for (const key of Object.keys(target)) delete target[key];
	Object.assign(target, values);
};

const DEFAULT_COUNT_MEASURE_KEY = "item";

export const normalizeServingMeasureAlias = (value: string) =>
	value.trim().toLowerCase().replace(/\s+/g, "");

export const configureServingMeasureCatalog = (
	catalog: ServingMeasureCatalog | null | undefined,
) => {
	const options = catalog?.options ?? [];
	SERVING_MEASURE_OPTIONS.splice(0, SERVING_MEASURE_OPTIONS.length, ...options);
	replaceRecord(SERVING_MEASURE_ALIASES, catalog?.aliases ?? {});
	SERVING_MEASURE_ALIAS_ENTRIES.splice(
		0,
		SERVING_MEASURE_ALIAS_ENTRIES.length,
		...(catalog?.aliasEntries ?? []),
	);

	const weightConversions: Record<string, number> = {};
	const volumeConversions: Record<string, number> = {};
	for (const option of options) {
		if (option.dimension === "weight") {
			weightConversions[option.value] = option.conversionToBase;
		} else if (option.dimension === "volume") {
			volumeConversions[option.value] = option.conversionToBase;
		}
	}
	replaceRecord(DEFAULT_GRAMS_PER_WEIGHT_MEASURE, weightConversions);
	replaceRecord(DEFAULT_MILLILITERS_PER_VOLUME_MEASURE, volumeConversions);
};

export const getDefaultServingMeasureUnit = (
	dimension: ServingMeasureDimension,
): ServingMeasureUnit | null =>
	SERVING_MEASURE_OPTIONS.find(
		(option) => option.dimension === dimension && option.isDefault,
	)?.value ??
	SERVING_MEASURE_OPTIONS.find((option) => option.dimension === dimension)
		?.value ??
	null;

export const getServingMeasureOption = (unit: ServingMeasureUnit) =>
	SERVING_MEASURE_OPTIONS.find((option) => option.value === unit) ?? null;

export const getDefaultCountMeasureUnit = () =>
	getDefaultServingMeasureUnit("count") ?? DEFAULT_COUNT_MEASURE_KEY;
