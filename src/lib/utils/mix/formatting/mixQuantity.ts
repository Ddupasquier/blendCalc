export type MixQuantitySign = "auto" | "always" | "never";

export type MixQuantityFormatOptions = {
	unit?: string | null;
	sign?: MixQuantitySign;
};

const TRACE_THRESHOLD = 0.001;
const quantityFormatter = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 3,
	useGrouping: true,
});

const getSign = (value: number, sign: MixQuantitySign) => {
	if (sign === "never" || Object.is(value, -0) || value === 0) return "";
	if (value < 0) return "−";
	return sign === "always" ? "+" : "";
};

const getUnitSuffix = (unit: string | null | undefined) => {
	const normalizedUnit = unit?.trim() ?? "";
	if (!normalizedUnit) return "";
	return normalizedUnit === "%" ? normalizedUnit : ` ${normalizedUnit}`;
};

export const formatMixQuantity = (
	value: number,
	{ unit = "", sign = "auto" }: MixQuantityFormatOptions = {},
) => {
	if (!Number.isFinite(value)) return "—";

	const absoluteValue = Math.abs(value);
	const magnitude =
		absoluteValue > 0 && absoluteValue < TRACE_THRESHOLD
			? `<${TRACE_THRESHOLD}`
			: quantityFormatter.format(absoluteValue);

	return `${getSign(value, sign)}${magnitude}${getUnitSuffix(unit)}`;
};
