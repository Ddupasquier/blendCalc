/**
 * Purpose: Normalize nutrient names/units and score cautious semantic matches against
 * canonical nutrient definitions. Ambiguous candidates remain unmatched for review.
 * Do not run directly; it is imported by reference-data seed workflows.
 */

export const normalizeUnitName = (value) =>
	String(value ?? "")
		.trim()
		.toUpperCase()
		.replaceAll("Μ", "U")
		.replaceAll("µ", "U")
		.replace("MCG", "UG")
		.replace("KILOCALORIES", "KCAL")
		.replace("KILOJOULES", "KJ");

const normalizeToken = (token) => {
	if (token === "fatty") return "fat";
	if (token.length > 3 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
	if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
	return token;
};

const IGNORED_NUTRIENT_TOKENS = new Set([
	"total",
	"including",
	"nlea",
	"by",
	"difference",
	"as",
	"the",
	"acid",
	"international",
	"unit",
	"d2",
	"d3",
]);

export const getNutrientTokens = (value) =>
	[...new Set(
		String(value ?? "")
			.toLowerCase()
			.replace(/\([^)]*\)/g, " ")
			.replace(/[^a-z0-9]+/g, " ")
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.map(normalizeToken)
			.filter((token) => !IGNORED_NUTRIENT_TOKENS.has(token)),
	)].sort();

const getTokenScore = (sourceTokens, candidateTokens) => {
	if (sourceTokens.length === 0 || candidateTokens.length === 0) return 0;
	const source = new Set(sourceTokens);
	const candidate = new Set(candidateTokens);
	const intersection = [...source].filter((token) => candidate.has(token)).length;
	const union = new Set([...source, ...candidate]).size;
	if (intersection === source.size && intersection === candidate.size) return 1;
	if (intersection === Math.min(source.size, candidate.size)) {
		return 0.82 + 0.12 * (intersection / Math.max(source.size, candidate.size));
	}
	return intersection / union;
};

const areMassUnits = (unit) => ["G", "MG", "UG"].includes(unit);
const areEnergyUnits = (unit) => ["KCAL", "KJ"].includes(unit);

const getUnitScore = (sourceUnit, targetUnit) => {
	if (!sourceUnit || !targetUnit) return 0;
	if (sourceUnit === targetUnit) return 0.08;
	if (areMassUnits(sourceUnit) && areMassUnits(targetUnit)) return 0.04;
	if (areEnergyUnits(sourceUnit) && areEnergyUnits(targetUnit)) return 0.04;
	return -0.12;
};

export const findCanonicalNutrientMatch = ({
	sourceName,
	sourceUnit,
	definitions,
	preferredNutrientIds = new Set(),
}) => {
	const sourceTokens = getNutrientTokens(sourceName);
	const normalizedSourceUnit = normalizeUnitName(sourceUnit);
	const candidates = definitions
		.map((definition) => {
			const candidateTokens = getNutrientTokens(definition.nutrient_name);
			const semanticScore = Math.min(
				1,
				getTokenScore(sourceTokens, candidateTokens) +
					getUnitScore(
						normalizedSourceUnit,
						normalizeUnitName(definition.default_unit_name),
					),
			);
			const preferred = preferredNutrientIds.has(definition.nutrient_id);
			const score = semanticScore;
			return {
				definition,
				score,
				preferred,
				observationCount: Number(definition.observation_count ?? 0),
			};
		})
		.sort(
			(left, right) =>
				right.score - left.score ||
				Number(right.preferred) - Number(left.preferred) ||
				right.observationCount - left.observationCount,
		);

	const best = candidates[0];
	const second = candidates[1];
	if (!best || best.score < 0.7) return null;
	if (second && best.score - second.score < 0.025 && best.score < 0.98) return null;
	const bestTokens = getNutrientTokens(best.definition.nutrient_name);
	const automaticApproval =
		sourceTokens.length === bestTokens.length &&
		sourceTokens.every((token) => bestTokens.includes(token));
	return { ...best, automaticApproval };
};
