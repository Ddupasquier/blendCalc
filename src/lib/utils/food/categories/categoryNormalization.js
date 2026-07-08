const SHORT_WORDS_TO_KEEP = new Set(["oil", "tea", "egg", "jam"]);

/**
 * @param {unknown} value
 */
const normalizeWords = (value) =>
	String(value ?? "")
		.toLocaleLowerCase()
		.trim()
		.replace(/^[a-z]{2}:/i, "")
		.replace(/&/g, " and ")
		.replace(/-/g, " ")
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();

/**
 * Normalize a food category exactly once before DB matching.
 *
 * @param {unknown} value
 */
export const normalizeFoodCategoryValue = (value) => normalizeWords(value);

/**
 * @param {unknown} value
 */
export const toFoodCategoryId = (value) =>
	normalizeFoodCategoryValue(value).replace(/\s+/g, "-");

/**
 * @param {unknown} value
 */
export const toFoodCategoryLabel = (value) =>
	normalizeFoodCategoryValue(value)
		.split(" ")
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toLocaleUpperCase()}${part.slice(1)}`)
		.join(" ");

/**
 * @param {unknown} value
 */
export const toFoodCategoryTokens = (value) =>
	normalizeFoodCategoryValue(value)
		.split(" ")
		.map((token) => {
			if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
			if (token.endsWith("s") && token.length > 3) return token.slice(0, -1);
			return token;
		})
		.filter((token) => token.length > 2 || SHORT_WORDS_TO_KEEP.has(token));

/**
 * @param {unknown} source
 * @param {unknown} candidate
 */
export const categoryTokensOverlap = (source, candidate) => {
	const sourceTokens = new Set(toFoodCategoryTokens(source));
	const candidateTokens = toFoodCategoryTokens(candidate);
	if (!sourceTokens.size || !candidateTokens.length) return false;
	return candidateTokens.every((token) => sourceTokens.has(token));
};
