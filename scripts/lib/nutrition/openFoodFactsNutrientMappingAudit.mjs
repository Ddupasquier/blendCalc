import {
	findCanonicalNutrientCandidate,
	normalizeUnitName,
} from "../reference-data/nutrientMatching.mjs";

const getEnglishText = (value, fallback = "") =>
	String(value?.en ?? value?.xx ?? fallback).trim();

export const getOpenFoodFactsTaxonomyRows = (taxonomy) =>
	Object.entries(taxonomy ?? {})
		.map(([taxonomyKey, entry]) => ({
			taxonomyKey,
			sourceNutrientKey: taxonomyKey.replace(/^[a-z]{2}:/i, ""),
			sourceNutrientName: getEnglishText(entry?.name, taxonomyKey),
			sourceUnitName: normalizeUnitName(getEnglishText(entry?.unit)),
		}))
		.filter((row) => row.sourceNutrientKey && row.sourceUnitName)
		.sort((left, right) =>
			left.sourceNutrientKey.localeCompare(right.sourceNutrientKey),
		);

export const getOpenFoodFactsObservationRows = (observations) =>
	(observations ?? [])
		.filter((row) => row.source_key === "open-food-facts")
		.map((row) => ({
			sourceNutrientKey: String(row.source_nutrient_key ?? "").trim(),
			sourceNutrientName: String(row.source_nutrient_name ?? "").trim(),
			sourceUnitName: normalizeUnitName(row.source_unit_name),
			observationCount: Number(row.observation_count ?? 0),
			firstObservedAt: row.first_observed_at ?? null,
			lastObservedAt: row.last_observed_at ?? null,
		}))
		.filter(
			(row) =>
				row.sourceNutrientKey &&
				row.sourceUnitName &&
				Number.isSafeInteger(row.observationCount) &&
				row.observationCount > 0,
		);

const getMappingOutcome = (mapping) => {
	if (mapping?.enabled && mapping.review_status === "approved")
		return "approved";
	if (mapping?.review_status === "rejected") return "rejected";
	if (mapping) return "pending_review";
	return "missing";
};

export const auditOpenFoodFactsNutrientMappings = ({
	taxonomy,
	mappings,
	observations = [],
	definitions = [],
	preferredNutrientIds = new Set(),
}) => {
	const offMappings = (mappings ?? []).filter(
		(mapping) => mapping.source_key === "open-food-facts",
	);
	const mappingByIdentity = new Map();
	for (const mapping of offMappings) {
		const identity = `${mapping.source_nutrient_key}\u0000${normalizeUnitName(mapping.source_unit_name)}`;
		const existing = mappingByIdentity.get(identity);
		if (
			!existing ||
			getMappingOutcome(mapping) === "approved" ||
			(existing.review_status !== "approved" &&
				getMappingOutcome(mapping) === "rejected")
		) {
			mappingByIdentity.set(identity, mapping);
		}
	}

	const taxonomyRows = getOpenFoodFactsTaxonomyRows(taxonomy);
	const observationRows = getOpenFoodFactsObservationRows(observations);
	const sourceRowsByIdentity = new Map();
	for (const row of taxonomyRows) {
		const identity = `${row.sourceNutrientKey}\u0000${row.sourceUnitName}`;
		sourceRowsByIdentity.set(identity, {
			...row,
			observationCount: 0,
			firstObservedAt: null,
			lastObservedAt: null,
		});
	}
	for (const observation of observationRows) {
		const identity = `${observation.sourceNutrientKey}\u0000${observation.sourceUnitName}`;
		const taxonomyRow = sourceRowsByIdentity.get(identity);
		sourceRowsByIdentity.set(identity, {
			...(taxonomyRow ?? {}),
			...observation,
			sourceNutrientName:
				taxonomyRow?.sourceNutrientName || observation.sourceNutrientName,
		});
	}

	const rows = [...sourceRowsByIdentity.values()]
		.sort((left, right) =>
			left.sourceNutrientKey.localeCompare(right.sourceNutrientKey),
		)
		.map((row) => {
			const identity = `${row.sourceNutrientKey}\u0000${row.sourceUnitName}`;
			const mapping = mappingByIdentity.get(identity);
			const candidate = mapping
				? null
				: findCanonicalNutrientCandidate({
						sourceName: row.sourceNutrientName,
						sourceUnit: row.sourceUnitName,
						definitions,
						preferredNutrientIds,
					});
			return {
				...row,
				outcome: mapping
					? getMappingOutcome(mapping)
					: candidate
						? "candidate_missing"
						: "unsupported",
				...(mapping
					? {
							nutrientId: Number(mapping.nutrient_id),
							reviewStatus: mapping.review_status,
							enabled: Boolean(mapping.enabled),
						}
					: {}),
				...(candidate
					? {
							candidateNutrientId: Number(candidate.definition.nutrient_id),
							candidateNutrientName: candidate.definition.nutrient_name,
							candidateUnitName: candidate.definition.default_unit_name,
							candidateConfidence: Number(candidate.score.toFixed(4)),
							candidateNameMatchKind: candidate.nameMatchKind,
							candidateUnitCompatibility: candidate.unitCompatibility,
						}
					: {}),
			};
		});
	const counts = {
		approved: rows.filter((row) => row.outcome === "approved").length,
		pendingReview: rows.filter((row) => row.outcome === "pending_review")
			.length,
		rejected: rows.filter((row) => row.outcome === "rejected").length,
		candidateMissing: rows.filter((row) => row.outcome === "candidate_missing")
			.length,
		unsupported: rows.filter((row) => row.outcome === "unsupported").length,
		observedCandidateMissing: rows.filter(
			(row) => row.outcome === "candidate_missing" && row.observationCount > 0,
		).length,
		observedUnsupported: rows.filter(
			(row) => row.outcome === "unsupported" && row.observationCount > 0,
		).length,
	};
	return {
		taxonomyNutrientCount: taxonomyRows.length,
		observedIdentityCount: observationRows.length,
		mappingIdentityCount: mappingByIdentity.size,
		counts,
		unresolved: rows.filter((row) =>
			["pending_review", "candidate_missing"].includes(row.outcome),
		),
		actionableUnresolved: rows.filter(
			(row) =>
				row.observationCount > 0 &&
				["pending_review", "candidate_missing"].includes(row.outcome),
		),
		rows,
	};
};

export const createOpenFoodFactsPendingMappingRows = (audit, observedAt) =>
	audit.rows
		.filter(
			(row) => row.outcome === "candidate_missing" && row.observationCount > 0,
		)
		.map((row) => ({
			source_key: "open-food-facts",
			source_nutrient_key: row.sourceNutrientKey,
			source_unit_name: row.sourceUnitName,
			source_nutrient_name: row.sourceNutrientName,
			nutrient_id: row.candidateNutrientId,
			priority: 50,
			mapping_method: "api_observation_match",
			confidence: row.candidateConfidence,
			enabled: false,
			review_status: "pending_review",
			observation_count: row.observationCount,
			first_observed_at: row.firstObservedAt,
			last_observed_at: row.lastObservedAt,
			provenance: {
				seed: "scripts/seeds/nutrition/seed_open_food_facts_nutrient_mapping_candidates.mjs",
				...(row.taxonomyKey ? { taxonomyKey: row.taxonomyKey } : {}),
				taxonomyName: row.sourceNutrientName,
				taxonomyUnit: row.sourceUnitName,
				candidateNameMatchKind: row.candidateNameMatchKind,
				candidateUnitCompatibility: row.candidateUnitCompatibility,
				queuedAt: observedAt,
				observationCount: row.observationCount,
			},
		}));
