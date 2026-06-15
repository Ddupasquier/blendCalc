import type { ServingMeasureUnit } from "../../../defaults/servingMeasureDefaults";

export type BarcodeVolumeEquivalent = {
	quantity: number;
	unit: Extract<ServingMeasureUnit, "ml" | "tsp" | "tbsp" | "cup" | "floz">;
};

const VOLUME_UNITS: Array<{
	unit: BarcodeVolumeEquivalent["unit"];
	pattern: string;
}> = [
	{ unit: "floz", pattern: "(?:fl\\.?\\s*oz\\.?|fluid\\s+ounces?)" },
	{ unit: "tbsp", pattern: "(?:tbsp\\.?|tablespoons?)" },
	{ unit: "tsp", pattern: "(?:tsp\\.?|teaspoons?)" },
	{ unit: "cup", pattern: "(?:cups?)" },
	{ unit: "ml", pattern: "(?:ml|millilit(?:er|re)s?)" },
];

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
	const quantityPattern = "(\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?)";

	for (const definition of VOLUME_UNITS) {
		const match = label.match(
			new RegExp(`${quantityPattern}\\s*${definition.pattern}\\b`, "i"),
		);
		if (!match) continue;
		const quantity = parseQuantity(match[1]);
		if (Number.isFinite(quantity) && quantity > 0) {
			return { quantity, unit: definition.unit };
		}
	}

	return null;
};
