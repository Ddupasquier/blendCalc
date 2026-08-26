/**
 * Purpose: Resolve source nutrient keys and units through enabled DB-derived mapping rows,
 * preferring explicit unit matches and refusing ambiguous nutrient identities. It also
 * protects reviewed semantic mappings when a later API-observation seed refreshes counts.
 * This is a pure shared module and does not query or mutate Supabase itself.
 * Do not run directly; use `node scripts/seeds/nutrition/seed_manual_entry_nutrients.mjs`.
 */

const normalizeKey = (value) =>
	String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/_100g$/i, "")
		.replace(/_/g, "-");

const NORMALIZED_UNIT_ALIASES = new Map([
	["GRAM", "G"],
	["GRAMS", "G"],
	["MILLIGRAM", "MG"],
	["MILLIGRAMS", "MG"],
	["MICROGRAM", "UG"],
	["MICROGRAMS", "UG"],
	["MCG", "UG"],
	["KILOCALORIE", "KCAL"],
	["KILOCALORIES", "KCAL"],
	["KILOJOULE", "KJ"],
	["KILOJOULES", "KJ"],
	["INTERNATIONAL UNIT", "IU"],
	["INTERNATIONAL UNITS", "IU"],
	["NIACIN EQUIVALENTS", "NE"],
]);

const normalizeUnit = (value) => {
	const normalized = String(value ?? "")
		.trim()
		.toUpperCase()
		.replaceAll("Μ", "U")
		.replaceAll("µ", "U");
	return NORMALIZED_UNIT_ALIASES.get(normalized) ?? normalized;
};

const compareMappings = (left, right) =>
	Number(left.priority ?? 1000) - Number(right.priority ?? 1000) ||
	Number(right.confidence ?? 0) - Number(left.confidence ?? 0);

const getMappingIdentity = (mapping) =>
	[
		mapping.source_key,
		normalizeKey(mapping.source_nutrient_key),
		normalizeUnit(mapping.source_unit_name),
	].join("\u0000");

const REVIEWED_MAPPING_METHODS = new Set([
	"api_id_match",
	"db_reviewed_api_key_match",
	"moderator_verified",
	"standards_dataset",
]);

const hasReviewEvidence = (mapping) =>
	Boolean(String(mapping.review_reference ?? "").trim() && mapping.reviewed_at);

const isReviewedMappingDecision = (mapping) =>
	(mapping.review_status === "rejected" && hasReviewEvidence(mapping)) ||
	(mapping.review_status === "approved" &&
		REVIEWED_MAPPING_METHODS.has(mapping.mapping_method) &&
		hasReviewEvidence(mapping));

export const preserveReviewedSourceNutrientMappings = ({
	existingMappings,
	observedMappings,
}) => {
	const existingByIdentity = new Map(
		existingMappings.map((mapping) => [getMappingIdentity(mapping), mapping]),
	);

	return observedMappings.map((observed) => {
		const existing = existingByIdentity.get(getMappingIdentity(observed));
		if (!existing || !isReviewedMappingDecision(existing)) {
			return observed;
		}

		return {
			...observed,
			source_nutrient_name:
				existing.source_nutrient_name ?? observed.source_nutrient_name,
			nutrient_id: existing.nutrient_id,
			priority: existing.priority,
			mapping_method: existing.mapping_method,
			confidence: existing.confidence,
			enabled: existing.enabled,
			review_status: existing.review_status,
			review_reference: existing.review_reference,
			reviewed_at: existing.reviewed_at,
			first_observed_at:
				existing.first_observed_at ?? observed.first_observed_at,
			provenance: {
				...(existing.provenance ?? {}),
				...(observed.provenance ?? {}),
				reviewedMappingPreserved: true,
			},
		};
	});
};

export const createSourceNutrientMappingCatalog = (mappings) => {
	const mappingsByKey = new Map();

	for (const mapping of mappings.filter(
		(candidate) => candidate.enabled && isReviewedMappingDecision(candidate),
	)) {
		const sourceKey = normalizeKey(mapping.source_nutrient_key);
		if (!sourceKey) continue;
		const candidates = mappingsByKey.get(sourceKey) ?? [];
		candidates.push(mapping);
		candidates.sort(compareMappings);
		mappingsByKey.set(sourceKey, candidates);
	}

	return {
		resolve({ sourceNutrientKey, sourceUnitName }) {
			const candidates =
				mappingsByKey.get(normalizeKey(sourceNutrientKey)) ?? [];
			if (candidates.length === 0) return null;

			const sourceUnit = normalizeUnit(sourceUnitName);
			return (
				candidates.find(
					(candidate) =>
						normalizeUnit(candidate.source_unit_name) === sourceUnit,
				) ?? null
			);
		},
	};
};
