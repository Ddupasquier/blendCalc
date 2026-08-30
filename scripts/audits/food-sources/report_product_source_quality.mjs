/**
 * Purpose: Read stored source evidence and print privacy-safe operational metrics,
 * selected canonical field contributions, current missing-field outcomes, and unresolved
 * disagreements for runtime or controlled benchmark lookups. This report is read-only
 * and requires Supabase script credentials.
 * Run: `npm run report:source-quality -- --days=30 --origin=runtime`
 * Benchmark report: `npm run report:source-quality -- --days=30 --origin=benchmark`
 * Structured report: `npm run report:source-quality -- --days=30 --origin=runtime --json`
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
	buildSourceContributionReport,
	buildSourceFieldAccuracyRows,
	buildSourceOperationalRows,
} from "../../lib/catalog/productSourceContributionReport.mjs";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const daysArgument = process.argv.find((argument) =>
	argument.startsWith("--days="),
);
const originArgument = process.argv.find((argument) =>
	argument.startsWith("--origin="),
);
const outputJson = process.argv.includes("--json");
const days = Math.max(
	1,
	Number.parseInt(daysArgument?.split("=")[1] ?? "30", 10),
);
const origin = originArgument?.split("=")[1] ?? "runtime";

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error(
		"Add PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.moderation.local.",
	);
}
if (!["runtime", "benchmark"].includes(origin)) {
	throw new Error("--origin must be runtime or benchmark.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
	auth: {
		autoRefreshToken: false,
		detectSessionInUrl: false,
		persistSession: false,
	},
	realtime: {
		transport: WebSocket,
	},
});

const databasePageSize = 1_000;

const queryAllRows = async (table, columns, configure = (query) => query) => {
	const rows = [];
	for (let offset = 0; ; offset += databasePageSize) {
		const query = configure(supabase.from(table).select(columns));
		const { data, error } = await query.range(
			offset,
			offset + databasePageSize - 1,
		);
		if (error) throw error;
		rows.push(...(data ?? []));
		if ((data?.length ?? 0) < databasePageSize) return rows;
	}
};

const since = new Date();
since.setUTCDate(since.getUTCDate() - days + 1);
const sinceDate = since.toISOString().slice(0, 10);

const now = new Date().toISOString();
const [
	metricRows,
	fieldMetricRows,
	sources,
	selectedProvenanceRows,
	observationRows,
	coverageRows,
	openConflictRows,
] = await Promise.all([
	queryAllRows("product_source_daily_metrics", "*", (query) =>
		query
			.gte("metric_date", sinceDate)
			.eq("lookup_origin", origin)
			.order("metric_date")
			.order("source_key")
			.order("lookup_kind")
			.order("source_data_type"),
	),
	queryAllRows("product_source_field_daily_metrics", "*", (query) =>
		query
			.gte("metric_date", sinceDate)
			.eq(
				"evaluation_origin",
				origin === "benchmark" ? "benchmark" : "runtime-catalog",
			)
			.order("metric_date")
			.order("source_key")
			.order("field_path"),
	),
	queryAllRows("product_data_sources", "key, display_name", (query) =>
		query.order("key"),
	),
	queryAllRows(
		"shared_product_field_provenance",
		"id, observation_id, field_path",
		(query) => query.eq("selected", true).order("id"),
	),
	queryAllRows("shared_product_observations", "id, source", (query) =>
		query.order("id"),
	),
	queryAllRows(
		"product_source_field_coverage",
		"barcode, provider_key, field_path, coverage_status",
		(query) =>
			query
				.gt("expires_at", now)
				.order("barcode")
				.order("provider_key")
				.order("field_path"),
	),
	queryAllRows(
		"shared_product_conflicts",
		"id, field_path, observed_values",
		(query) => query.eq("status", "open").order("id"),
	),
]);

const sourceNames = new Map(
	(sources ?? []).map((source) => [source.key, source.display_name]),
);
const operationalRows = buildSourceOperationalRows(
	metricRows ?? [],
	sourceNames,
);
const contributionReport = buildSourceContributionReport({
	observationRows: observationRows ?? [],
	selectedProvenanceRows: selectedProvenanceRows ?? [],
	coverageRows: coverageRows ?? [],
	openConflictRows: openConflictRows ?? [],
	sourceNames,
});
const fieldAccuracyRows = buildSourceFieldAccuracyRows(
	fieldMetricRows ?? [],
	sourceNames,
);

if (outputJson) {
	console.log(
		JSON.stringify(
			{
				period: { sinceDate, through: now.slice(0, 10), origin },
				operationalRows,
				fieldAccuracyRows,
				...contributionReport,
			},
			null,
			2,
		),
	);
	process.exit(0);
}

console.log(`Product source quality: ${sinceDate} through today (${origin})`);
if (operationalRows.length === 0) {
	console.log("No source metrics have been recorded in this period yet.");
} else {
	console.table(
		operationalRows.map((row) => ({
			Source: row.source,
			Lookups: row.lookups,
			"API calls": row.apiRequests,
			"Calls / lookup": row.requestsPerLookup,
			"Cache hits": row.cacheHits,
			"API errors": row.apiErrors,
			"Match %": row.matchPercent,
			"Exact barcode": row.exactBarcodeMatches,
			"Avg nutrients": row.averageNutrients,
			"Metadata %": row.metadataPercent,
			"Avg ms": row.averageResponseMilliseconds,
			"Coverage index": row.coverageIndex,
		})),
	);
	const inefficientSources = operationalRows.filter(
		(row) => row.requestsPerLookup > 2.5,
	);
	if (inefficientSources.length > 0) {
		console.warn(
			`Review request fan-out for: ${inefficientSources.map((row) => row.source).join(", ")}. Each source averaged more than 2.5 outbound calls per logical lookup.`,
		);
	}
}
console.log("\nField-level source outcomes");
if (fieldAccuracyRows.length === 0) {
	console.log(
		"No field-level source outcomes have been recorded in this period.",
	);
} else {
	console.table(
		fieldAccuracyRows.map((row) => ({
			Source: row.source,
			Field: row.fieldPath,
			Evaluated: row.evaluatedCount,
			Selected: row.selectedCount,
			"Internally invalid": row.internallyInvalidCount,
			"Cross-source disagreement": row.crossSourceDisagreementCount,
			"Submitted-label disagreement": row.submittedLabelDisagreementCount,
			"Confirmed label correction": row.confirmedLabelCorrectionCount,
		})),
	);
}
console.log("\nCurrent canonical contributions and source outcomes");
if (contributionReport.sourceRows.length === 0) {
	console.log(
		"No current field contribution, coverage, or disagreement evidence exists.",
	);
} else {
	console.table(
		contributionReport.sourceRows.map((row) => ({
			Source: row.source,
			"Selected fields": row.selectedFieldCount,
			Reported: row.reportedCoverageCount,
			"Not reported": row.notReportedCoverageCount,
			"Not applicable": row.notApplicableCoverageCount,
			"Products not found": row.productNotFoundCount,
			"Open disagreements": row.openDisagreementCount,
		})),
	);
}
console.log(
	"Coverage index measures observed match/fullness/reliability, not authority. Runtime fallback sources receive harder requests, so use benchmark-origin rows for direct source comparisons.",
);
console.log(
	"Selected fields are accepted canonical contributions. Coverage describes current lookup outcomes only; it is not provenance. Disagreements remain unresolved evidence conflicts until reviewed current-label evidence confirms a correction. Use --json for field-level counts.",
);
