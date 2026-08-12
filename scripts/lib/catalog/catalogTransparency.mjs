/**
 * Purpose: Provide semantic definitions and pure coverage helpers for the read-only
 * catalog transparency audit. Do not run directly.
 * Parent workflow: `node scripts/audits/catalog/audit_catalog_transparency.mjs`
 */

export const CATALOG_TRANSPARENCY_SEMANTICS = [
	{
		key: "lastVerified",
		label: "Last verified",
		owner: "shared_products.last_verified_at",
		meaning:
			"The latest evidence-backed verification event accepted by blendCalc.",
		missing:
			"Unknown. Never substitute updated_at, a provider fetch date, or the current time.",
		api: "revision.lastVerifiedAt",
		app: "Catalog read model only; no user-facing presentation yet.",
	},
	{
		key: "currentLabelSince",
		label: "Current label since",
		owner:
			"Manufacturer effective date when explicitly supplied; otherwise shared_product_revisions.label_observed_at",
		meaning:
			"When the current formulation or label became effective, or when blendCalc explicitly observed it when no manufacturer date exists.",
		missing:
			"Unknown. revision.created_at and shared_products.updated_at are not manufacturer label dates.",
		api: "revision.labelObservedAt; a future manufacturer date must remain a distinct field",
		app: "Not presented until the source of the date can be labeled accurately.",
	},
	{
		key: "revisionHistory",
		label: "Revision history",
		owner:
			"shared_product_revisions and shared_product_revision_changes",
		meaning:
			"Immutable accepted catalog snapshots plus evidence-backed field changes.",
		missing:
			"No reconstructable history. Never infer historical changes by comparing unrelated provider records.",
		api: "Current revision metadata plus the separate bounded product revision-history endpoint.",
		app: "Current catalog revision is loaded server-side; history is not presented.",
	},
	{
		key: "fieldProvenance",
		label: "Selected field provenance",
		owner:
			"shared_product_field_provenance joined to shared_product_observations",
		meaning:
			"The selected observation, method, confidence, source reference, and observation date for an accepted canonical field.",
		missing:
			"Unknown lineage. Never fall back to the whole-product provider as field evidence.",
		api: "fieldSources",
		app: "Canonical food snapshots expose bounded source labels; moderators can inspect the deeper field and observation record through a role-gated, non-cacheable endpoint.",
	},
	{
		key: "sourceQuality",
		label: "Source quality metadata",
		owner: "shared_products.food.sourceMetadata",
		meaning:
			"Source-reported completeness, schema version, quality tags, timestamps, languages, and obsolete state.",
		missing:
			"Not reported by the source. Absence is not a low-quality verdict.",
		api: "sourceRecord",
		app: "Nutrition details presents bounded friendly source-record caveats in a closed Data quality disclosure when useful; raw provider tags remain hidden. Product details owns field sources, attribution, and licensing.",
	},
	{
		key: "ingredientAnalysis",
		label: "Structured ingredient analysis",
		owner:
			"shared_products.food.structuredIngredients and shared_products.food.ingredientAnalysis",
		meaning:
			"Source-reported ingredient structure, percentages, tags, and analysis coverage.",
		missing:
			"Unavailable. Never derive ingredient percentages or safety declarations from a product title.",
		api: "ingredients.structured and ingredients.analysis",
		app: "Nutrition details reads ingredients and compatibility evidence; full analysis is not yet presented.",
	},
	{
		key: "servingProvenance",
		label: "Serving provenance",
		owner: "food_servings",
		meaning:
			"Reported serving value with its source, reference, confidence, and linked observation or revision.",
		missing:
			"No reported serving. The 100g nutrition basis remains a basis, not a source serving.",
		api: "servings[].source",
		app: "Nutrition and Mix read normalized servings; detailed serving evidence is not yet presented.",
	},
	{
		key: "nutrientUncertainty",
		label: "Nutrient uncertainty",
		owner:
			"generic_food_nutrients.standard_error, observation_count, nutrient_source_code, mapping_status, and value_status",
		meaning:
			"Source-reported statistical uncertainty and mapping state for generic-food nutrient measurements.",
		missing:
			"Unknown uncertainty. Never alter displayed nutrient math or infer certainty from absence.",
		api: "Not exposed by API v1.",
		app: "Not consumed by user-facing nutrient calculations.",
	},
	{
		key: "policySnapshots",
		label: "Compatibility policy snapshots",
		owner: "food_compatibility_policy_versions",
		meaning:
			"Immutable match/conflict rule snapshots and reviewed source references for a numbered policy version.",
		missing:
			"No reproducible policy version. Compatibility results must not claim a version without snapshots.",
		api: "Not exposed by API v1.",
		app: "Loaded by the server-side food-safety evaluator.",
	},
	{
		key: "compatibilityEvidence",
		label: "Compatibility evidence",
		owner: "product_compatibility_facts",
		meaning:
			"Policy-versioned evidence extracted from ingredients, explicit declarations, traces, source identity, or reviewed analysis.",
		missing:
			"No conflict found in available evidence; never present this as proof that a food is safe.",
		api: "warnings",
		app: "Server evaluation and nutrition/search/list warning explanations.",
	},
];

/**
 * @typedef {object} CoverageInput
 * @property {string} key
 * @property {string} label
 * @property {number} populated
 * @property {number} total
 * @property {string} [unit]
 * @property {string[]} [representatives]
 */

/**
 * @typedef {object} SourceMetadata
 * @property {number | null} [completeness]
 * @property {number | null} [schemaVersion]
 * @property {number | null} [revision]
 * @property {string | null} [createdAt]
 * @property {string | null} [publishedAt]
 * @property {string | null} [availableAt]
 * @property {string | null} [modifiedAt]
 * @property {string | null} [updatedAt]
 * @property {string | null} [discontinuedAt]
 * @property {string | null} [language]
 * @property {string[]} [languages]
 * @property {string[]} [marketCountries]
 * @property {string[]} [qualityTags]
 * @property {string[]} [qualityErrorTags]
 * @property {string[]} [qualityWarningTags]
 * @property {boolean | null} [obsolete]
 * @property {string | null} [obsoleteSince]
 * @property {Record<string, string[]>} [tagSources]
 */

/**
 * @typedef {object} TransparencyFood
 * @property {unknown[]} [structuredIngredients]
 * @property {object | null} [ingredientAnalysis]
 * @property {SourceMetadata | null} [sourceMetadata]
 */

/**
 * @param {number} populated
 * @param {number} total
 */
export const classifyCoverage = (populated, total) => {
	if (populated <= 0 || total <= 0) return "empty";
	return populated >= total ? "populated" : "sparse";
};

/** @param {CoverageInput} input */
export const createCoverageRow = ({
	key,
	label,
	populated,
	total,
	unit = "records",
	representatives = [],
}) => ({
	key,
	label,
	state: classifyCoverage(populated, total),
	populated,
	total,
	percent: total > 0 ? Number(((populated / total) * 100).toFixed(1)) : 0,
	unit,
	representatives,
});

/** @param {TransparencyFood | null | undefined} food */
export const hasStructuredIngredientAnalysis = (food) =>
	Boolean(
		(Array.isArray(food?.structuredIngredients) &&
			food.structuredIngredients.length > 0) ||
			food?.ingredientAnalysis,
	);

/** @param {TransparencyFood | null | undefined} food */
export const hasSourceQualityMetadata = (food) => {
	const metadata = food?.sourceMetadata;
	if (!metadata || typeof metadata !== "object") return false;
	return Boolean(
		(metadata.completeness !== null &&
			metadata.completeness !== undefined) ||
			(metadata.schemaVersion !== null &&
				metadata.schemaVersion !== undefined) ||
			(metadata.revision !== null && metadata.revision !== undefined) ||
			metadata.createdAt ||
			metadata.publishedAt ||
			metadata.availableAt ||
			metadata.modifiedAt ||
			metadata.updatedAt ||
			metadata.discontinuedAt ||
			metadata.language ||
			(Array.isArray(metadata.languages) && metadata.languages.length > 0) ||
			(Array.isArray(metadata.marketCountries) &&
				metadata.marketCountries.length > 0) ||
			(Array.isArray(metadata.qualityTags) &&
				metadata.qualityTags.length > 0) ||
			(Array.isArray(metadata.qualityErrorTags) &&
				metadata.qualityErrorTags.length > 0) ||
			(Array.isArray(metadata.qualityWarningTags) &&
				metadata.qualityWarningTags.length > 0) ||
			(metadata.obsolete !== null && metadata.obsolete !== undefined) ||
			metadata.obsoleteSince ||
			(metadata.tagSources &&
				typeof metadata.tagSources === "object" &&
				Object.keys(metadata.tagSources).length > 0),
	);
};
