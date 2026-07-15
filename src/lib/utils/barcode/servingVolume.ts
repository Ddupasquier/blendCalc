import {
	SERVING_MEASURE_ALIAS_ENTRIES,
	getServingMeasureOption,
	normalizeServingMeasureAlias,
	type ServingMeasureUnit,
} from "$lib/utils/serving/servingMeasureCatalog";

export type BarcodeVolumeEquivalent = {
	quantity: number;
	unit: ServingMeasureUnit;
};

const parseQuantity = (value: string) => {
	const normalized = value.trim();
	const mixedNumber = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
	if (mixedNumber) {
		return Number(mixedNumber[1]) + Number(mixedNumber[2]) / Number(mixedNumber[3]);
	}
	const fraction = normalized.match(/^(\d+)\/(\d+)$/);
	if (fraction) return Number(fraction[1]) / Number(fraction[2]);
	return Number.parseFloat(normalized);
};

export const parseVolumeEquivalent = (
	label?: string,
): BarcodeVolumeEquivalent | null => {
	if (!label) return null;
	const match = label.match(
		/(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*([a-zA-Z.\s]+)/,
	);
	if (!match) return null;

	const quantity = parseQuantity(match[1]);
	if (!Number.isFinite(quantity) || quantity <= 0) return null;
	const normalizedUnitText = normalizeServingMeasureAlias(
		match[2].replaceAll(".", ""),
	);
	const alias = [...SERVING_MEASURE_ALIAS_ENTRIES]
		.sort(
			(left, right) =>
				normalizeServingMeasureAlias(right.alias).length -
				normalizeServingMeasureAlias(left.alias).length,
		)
		.find((entry) =>
			normalizedUnitText.startsWith(
				normalizeServingMeasureAlias(entry.alias.replaceAll(".", "")),
			),
		);
	if (!alias || getServingMeasureOption(alias.unit)?.dimension !== "volume") {
		return null;
	}

	return { quantity, unit: alias.unit };
};
