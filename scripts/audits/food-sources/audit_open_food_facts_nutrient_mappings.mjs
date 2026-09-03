/**
 * Purpose: Compare the complete current Open Food Facts nutrient taxonomy with
 * blendCalc's reviewed mapping catalog. This command is read-only and writes an
 * ignored JSON report; --strict exits nonzero while a review candidate is unqueued.
 * Run: `npm run audit:off-nutrient-mappings`
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { auditOpenFoodFactsNutrientMappings } from "../../lib/nutrition/openFoodFactsNutrientMappingAudit.mjs";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const reportArgument = process.argv.find((value) =>
	value.startsWith("--report="),
);
const reportPath = reportArgument
	? path.resolve(reportArgument.slice("--report=".length))
	: path.resolve("scripts/output/open-food-facts-nutrient-mappings.json");
const strict = process.argv.includes("--strict");
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
	throw new Error(
		"PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
	);
}

const response = await fetch(
	"https://static.openfoodfacts.org/data/taxonomies/nutrients.json",
	{
		headers: {
			accept: "application/json",
			"user-agent": "blendCalc Open Food Facts nutrient mapping audit",
		},
		signal: AbortSignal.timeout(30_000),
	},
);
if (!response.ok) {
	throw new Error(
		`Open Food Facts nutrient taxonomy returned ${response.status}.`,
	);
}
const taxonomy = await response.json();
const supabase = createClient(supabaseUrl, serviceRoleKey, {
	auth: {
		autoRefreshToken: false,
		detectSessionInUrl: false,
		persistSession: false,
	},
});
const [mappingsResult, observationsResult, definitionsResult, preferredResult] =
	await Promise.all([
		supabase
			.from("nutrient_source_mappings")
			.select(
				"source_key,source_nutrient_key,source_unit_name,nutrient_id,review_status,enabled",
			)
			.eq("source_key", "open-food-facts")
			.range(0, 4999),
		supabase
			.from("nutrient_source_mapping_observations")
			.select(
				"source_key,source_nutrient_key,source_unit_name,source_nutrient_name,observation_count,first_observed_at,last_observed_at",
			)
			.eq("source_key", "open-food-facts")
			.range(0, 4999),
		supabase
			.from("nutrient_definitions")
			.select("nutrient_id,nutrient_name,nutrient_number,default_unit_name")
			.range(0, 4999),
		supabase
			.from("nutrient_manual_entry_required_nutrients")
			.select("nutrient_id")
			.eq("enabled", true),
	]);
for (const result of [
	mappingsResult,
	observationsResult,
	definitionsResult,
	preferredResult,
]) {
	if (result.error) throw result.error;
}

const audit = auditOpenFoodFactsNutrientMappings({
	taxonomy,
	mappings: mappingsResult.data ?? [],
	observations: observationsResult.data ?? [],
	definitions: definitionsResult.data ?? [],
	preferredNutrientIds: new Set(
		(preferredResult.data ?? []).map((row) => Number(row.nutrient_id)),
	),
});
const report = {
	generatedAt: new Date().toISOString(),
	taxonomySource:
		"https://static.openfoodfacts.org/data/taxonomies/nutrients.json",
	...audit,
};
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.table([
	{
		"Taxonomy nutrients": audit.taxonomyNutrientCount,
		"Observed identities": audit.observedIdentityCount,
		Approved: audit.counts.approved,
		"Pending review": audit.counts.pendingReview,
		Rejected: audit.counts.rejected,
		"Observed candidate not queued": audit.counts.observedCandidateMissing,
		"Observed unsupported": audit.counts.observedUnsupported,
		"Taxonomy-only candidate":
			audit.counts.candidateMissing - audit.counts.observedCandidateMissing,
	},
]);
console.log(`Detailed report: ${reportPath}`);
if (strict && audit.counts.observedCandidateMissing > 0) process.exitCode = 1;
