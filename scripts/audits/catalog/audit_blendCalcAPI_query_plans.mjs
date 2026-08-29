/**
 * Purpose: Measure representative and bounded worst-case PostgreSQL plans behind
 * blendCalcAPI product, search, revision, and category reads. This audit is read-only,
 * uses disposable local Supabase, and recommends index review only from measured scans.
 * Run: `node scripts/audits/catalog/audit_blendCalcAPI_query_plans.mjs`
 * Structured output: `node scripts/audits/catalog/audit_blendCalcAPI_query_plans.mjs --json`
 */

import { spawnSync } from "node:child_process";
import { summarizePostgresQueryPlan } from "../../lib/catalog/blendCalcAPIQueryPlanAudit.mjs";

const outputJson = process.argv.includes("--json");
const containerName =
	process.argv
		.find((argument) => argument.startsWith("--container="))
		?.slice("--container=".length) ?? "supabase_db_blendcalc";

const scenarios = [
	{
		name: "exact product",
		sql: "select * from public.get_blendcalc_api_product_v1('00021130493609')",
	},
	{
		name: "exact product index predicate",
		sql: "select id from public.shared_products where status = 'active' and barcode = '00021130493609' limit 1",
	},
	{
		name: "representative first-page search",
		sql: "select * from public.search_blendcalc_api_products_v1('roasted onion garlic', array['roasted','onion','garlic']::text[], 15, 0)",
	},
	{
		name: "broad first-page search",
		sql: "select * from public.search_blendcalc_api_products_v1('a', array['a']::text[], 50, 0)",
	},
	{
		name: "bounded deepest search page",
		sql: "select * from public.search_blendcalc_api_products_v1('a', array['a']::text[], 50, 1000)",
	},
	{
		name: "broad search core predicate",
		sql: "select id from public.shared_products where status = 'active' and strpos(lower(search_text), 'a') > 0 order by product_name, id limit 50 offset 1000",
	},
	{
		name: "bounded deepest revision page",
		sql: "select * from public.get_blendcalc_api_product_revision_history_v1('00021130493609', 100, 1000)",
	},
	{
		name: "category first page",
		sql: "select id, label, normalized_value, updated_at from public.custom_food_category_options where enabled order by label, id limit 50 offset 0",
	},
	{
		name: "bounded deepest category page",
		sql: "select id, label, normalized_value, updated_at from public.custom_food_category_options where enabled order by label, id limit 50 offset 1000",
	},
];

const runExplain = (sql) => {
	const result = spawnSync(
		"docker",
		[
			"exec",
			"-i",
			containerName,
			"psql",
			"-U",
			"postgres",
			"-d",
			"postgres",
			"-Atq",
			"-v",
			"ON_ERROR_STOP=1",
			"-c",
			`explain (analyze, buffers, format json) ${sql}`,
		],
		{ encoding: "utf8" },
	);
	if (result.status !== 0) {
		throw new Error(
			result.stderr.trim() ||
				`Unable to inspect PostgreSQL plans in ${containerName}. Start the local test database first.`,
		);
	}
	return JSON.parse(result.stdout);
};

const results = scenarios.map((scenario) => ({
	name: scenario.name,
	...summarizePostgresQueryPlan(runExplain(scenario.sql)),
}));
const reviewFindings = results.flatMap((result) =>
	result.sequentialScansNeedingReview.map((scan) => ({
		scenario: result.name,
		...scan,
	})),
);

if (outputJson) {
	console.log(
		JSON.stringify(
			{
				measuredAt: new Date().toISOString(),
				containerName,
				results,
				reviewFindings,
			},
			null,
			2,
		),
	);
} else {
	console.log(`blendCalcAPI query-plan audit: ${containerName}`);
	console.table(
		results.map((result) => ({
			Scenario: result.name,
			"Execution ms": result.executionMilliseconds,
			"Planning ms": result.planningMilliseconds,
			"Returned rows": result.returnedRows,
			"Buffer hits": result.sharedBufferHits,
			"Buffer reads": result.sharedBufferReads,
			"Sequential scans": result.sequentialScans.length,
			"Index review": result.sequentialScansNeedingReview.length > 0,
		})),
	);
}

if (reviewFindings.length > 0) {
	throw new Error(
		`Measured plans require index review:\n${reviewFindings
			.map(
				(finding) =>
					`- ${finding.scenario}: ${finding.relation} processed ${finding.processedRows} rows`,
			)
			.join("\n")}`,
	);
}
