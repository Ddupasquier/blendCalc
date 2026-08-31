import { createHash } from "node:crypto";

const normalizeJsonValue = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(normalizeJsonValue);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, entry]) => entry !== undefined)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, normalizeJsonValue(entry)]),
		);
	}
	return value;
};

export const stringifyCanonicalJson = (value: unknown) =>
	JSON.stringify(normalizeJsonValue(value));

export const hashCanonicalJson = (value: unknown) =>
	createHash("sha256").update(stringifyCanonicalJson(value)).digest("hex");
