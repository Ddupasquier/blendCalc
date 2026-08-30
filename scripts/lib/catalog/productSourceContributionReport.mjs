/**
 * Purpose: Aggregate privacy-safe source metrics, selected canonical field evidence,
 * active field coverage, and unresolved source disagreements for the source-quality
 * audit. This module performs no database reads. Do not run directly.
 * Parent workflow: `npm run report:source-quality -- --days=30 --origin=runtime`
 */

const numericMetricFields = [
	"lookup_count",
	"api_request_count",
	"api_error_count",
	"cache_hit_count",
	"completed_lookup_count",
	"match_count",
	"exact_barcode_match_count",
	"error_count",
	"evaluated_product_count",
	"reported_nutrient_total",
	"brand_present_count",
	"category_present_count",
	"serving_present_count",
	"ingredients_present_count",
	"image_present_count",
	"response_milliseconds_total",
];

const percentage = (numerator, denominator) =>
	denominator > 0 ? (numerator / denominator) * 100 : 0;

const rounded = (value, digits = 1) => Number(value.toFixed(digits));

const getSourceDisplayName = (sourceNames, sourceKey) =>
	sourceNames.get(sourceKey) ?? sourceKey;

const getContributionKey = (sourceKey, fieldPath) =>
	JSON.stringify([sourceKey, fieldPath]);

const getOrCreateContribution = (contributions, sourceKey, fieldPath) => {
	const key = getContributionKey(sourceKey, fieldPath);
	const existing = contributions.get(key);
	if (existing) return existing;

	const contribution = {
		sourceKey,
		fieldPath,
		selectedFieldCount: 0,
		reportedCoverageCount: 0,
		notReportedCoverageCount: 0,
		notApplicableCoverageCount: 0,
		productNotFoundCount: 0,
		openDisagreementCount: 0,
	};
	contributions.set(key, contribution);
	return contribution;
};

/**
 * @param {Array<Record<string, unknown>>} metricRows
 * @param {Map<string, string>} sourceNames
 */
export const buildSourceOperationalRows = (metricRows, sourceNames) => {
	const totals = new Map();

	for (const row of metricRows) {
		const sourceKey = String(row.source_key);
		const total =
			totals.get(sourceKey) ??
			Object.fromEntries(numericMetricFields.map((field) => [field, 0]));
		for (const field of numericMetricFields) {
			total[field] += Number(row[field] ?? 0);
		}
		totals.set(sourceKey, total);
	}

	return [...totals.entries()]
		.map(([sourceKey, total]) => {
			const matchRate = percentage(total.match_count, total.lookup_count);
			const reliabilityRate = percentage(
				total.completed_lookup_count,
				total.lookup_count,
			);
			const averageNutrients =
				total.evaluated_product_count > 0
					? total.reported_nutrient_total / total.evaluated_product_count
					: 0;
			const metadataFields =
				total.brand_present_count +
				total.category_present_count +
				total.serving_present_count +
				total.ingredients_present_count +
				total.image_present_count;
			const metadataCoverage = percentage(
				metadataFields,
				total.evaluated_product_count * 5,
			);
			const coverageIndex =
				matchRate * 0.35 +
				reliabilityRate * 0.15 +
				Math.min(averageNutrients / 20, 1) * 100 * 0.25 +
				metadataCoverage * 0.25;

			return {
				sourceKey,
				source: getSourceDisplayName(sourceNames, sourceKey),
				lookups: total.lookup_count,
				apiRequests: total.api_request_count,
				requestsPerLookup: rounded(
					total.api_request_count / Math.max(total.lookup_count, 1),
					2,
				),
				cacheHits: total.cache_hit_count,
				apiErrors: total.api_error_count,
				matchPercent: rounded(matchRate),
				exactBarcodeMatches: total.exact_barcode_match_count,
				averageNutrients: rounded(averageNutrients),
				metadataPercent: rounded(metadataCoverage),
				averageResponseMilliseconds: rounded(
					total.response_milliseconds_total / Math.max(total.lookup_count, 1),
					0,
				),
				coverageIndex: rounded(coverageIndex),
			};
		})
		.sort((left, right) => right.coverageIndex - left.coverageIndex);
};

const sourceFieldMetricNames = [
	"evaluated_count",
	"selected_count",
	"internally_invalid_count",
	"cross_source_disagreement_count",
	"submitted_label_disagreement_count",
	"confirmed_label_correction_count",
];

/**
 * @param {Array<Record<string, unknown>>} metricRows
 * @param {Map<string, string>} sourceNames
 */
export const buildSourceFieldAccuracyRows = (metricRows, sourceNames) => {
	const totals = new Map();
	for (const metric of metricRows) {
		const sourceKey = String(metric.source_key);
		const fieldPath = String(metric.field_path);
		const key = getContributionKey(sourceKey, fieldPath);
		const total =
			totals.get(key) ??
			Object.fromEntries(sourceFieldMetricNames.map((field) => [field, 0]));
		for (const field of sourceFieldMetricNames) {
			total[field] += Number(metric[field] ?? 0);
		}
		totals.set(key, { ...total, sourceKey, fieldPath });
	}

	return [...totals.values()]
		.map((total) => ({
			sourceKey: total.sourceKey,
			source: getSourceDisplayName(sourceNames, total.sourceKey),
			fieldPath: total.fieldPath,
			evaluatedCount: total.evaluated_count,
			selectedCount: total.selected_count,
			internallyInvalidCount: total.internally_invalid_count,
			crossSourceDisagreementCount: total.cross_source_disagreement_count,
			submittedLabelDisagreementCount: total.submitted_label_disagreement_count,
			confirmedLabelCorrectionCount: total.confirmed_label_correction_count,
			internallyInvalidPercent: rounded(
				percentage(total.internally_invalid_count, total.evaluated_count),
			),
			crossSourceDisagreementPercent: rounded(
				percentage(
					total.cross_source_disagreement_count,
					total.evaluated_count,
				),
			),
			confirmedLabelCorrectionPercent: rounded(
				percentage(
					total.confirmed_label_correction_count,
					total.evaluated_count,
				),
			),
		}))
		.sort(
			(left, right) =>
				left.source.localeCompare(right.source) ||
				left.fieldPath.localeCompare(right.fieldPath),
		);
};

/**
 * @param {object} input
 * @param {Array<{id: string, source: string}>} input.observationRows
 * @param {Array<{observation_id: string, field_path: string}>} input.selectedProvenanceRows
 * @param {Array<{provider_key: string, field_path: string, coverage_status: string}>} input.coverageRows
 * @param {Array<{field_path: string, observed_values: unknown}>} input.openConflictRows
 * @param {Map<string, string>} input.sourceNames
 */
export const buildSourceContributionReport = ({
	observationRows,
	selectedProvenanceRows,
	coverageRows,
	openConflictRows,
	sourceNames,
}) => {
	const observationSources = new Map(
		observationRows.map((observation) => [observation.id, observation.source]),
	);
	const contributions = new Map();

	for (const provenance of selectedProvenanceRows) {
		const sourceKey = observationSources.get(provenance.observation_id);
		if (!sourceKey) continue;
		getOrCreateContribution(
			contributions,
			sourceKey,
			provenance.field_path,
		).selectedFieldCount += 1;
	}

	for (const coverage of coverageRows) {
		const contribution = getOrCreateContribution(
			contributions,
			coverage.provider_key,
			coverage.field_path,
		);
		switch (coverage.coverage_status) {
			case "reported":
				contribution.reportedCoverageCount += 1;
				break;
			case "not-reported":
				contribution.notReportedCoverageCount += 1;
				break;
			case "not-applicable":
				contribution.notApplicableCoverageCount += 1;
				break;
			case "product-not-found":
				contribution.productNotFoundCount += 1;
				break;
		}
	}

	for (const conflict of openConflictRows) {
		if (!Array.isArray(conflict.observed_values)) continue;
		const conflictSources = new Set(
			conflict.observed_values.flatMap((observedValue) => {
				if (
					typeof observedValue !== "object" ||
					observedValue === null ||
					typeof observedValue.source !== "string"
				) {
					return [];
				}
				return [observedValue.source];
			}),
		);
		for (const sourceKey of conflictSources) {
			getOrCreateContribution(
				contributions,
				sourceKey,
				conflict.field_path,
			).openDisagreementCount += 1;
		}
	}

	const fieldRows = [...contributions.values()]
		.map((contribution) => ({
			...contribution,
			source: getSourceDisplayName(sourceNames, contribution.sourceKey),
		}))
		.sort(
			(left, right) =>
				left.source.localeCompare(right.source) ||
				left.fieldPath.localeCompare(right.fieldPath),
		);

	const sourceTotals = new Map();
	for (const fieldRow of fieldRows) {
		const total = sourceTotals.get(fieldRow.sourceKey) ?? {
			sourceKey: fieldRow.sourceKey,
			source: fieldRow.source,
			selectedFieldCount: 0,
			reportedCoverageCount: 0,
			notReportedCoverageCount: 0,
			notApplicableCoverageCount: 0,
			productNotFoundCount: 0,
			openDisagreementCount: 0,
		};
		for (const key of [
			"selectedFieldCount",
			"reportedCoverageCount",
			"notReportedCoverageCount",
			"notApplicableCoverageCount",
			"productNotFoundCount",
			"openDisagreementCount",
		]) {
			total[key] += fieldRow[key];
		}
		sourceTotals.set(fieldRow.sourceKey, total);
	}

	return {
		sourceRows: [...sourceTotals.values()].sort((left, right) =>
			left.source.localeCompare(right.source),
		),
		fieldRows,
	};
};
