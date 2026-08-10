export const toFiniteNumber = (value: unknown): number | null => {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}
	if (typeof value !== "string" || !value.trim()) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
};

export const toFiniteNonnegativeNumber = (value: unknown): number | null => {
	const parsed = toFiniteNumber(value);
	return parsed !== null && parsed >= 0 ? parsed : null;
};

export const toFinitePositiveNumber = (value: unknown): number | null => {
	const parsed = toFiniteNumber(value);
	return parsed !== null && parsed > 0 ? parsed : null;
};
