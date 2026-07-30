import type { ParamMatcher } from "@sveltejs/kit";

export const match: ParamMatcher = (value) => {
	if (!/^-?\d+$/.test(value)) return false;
	return Number.isSafeInteger(Number(value));
};
