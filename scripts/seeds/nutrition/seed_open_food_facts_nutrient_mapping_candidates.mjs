/**
 * Purpose: Preview or enqueue exact Open Food Facts taxonomy key/unit identities that
 * have one cautious canonical nutrient candidate but no existing mapping decision.
 * Run: `npm run seed:off-nutrient-mapping-candidates`
 * Apply only after review: `npm run seed:off-nutrient-mapping-candidates -- --apply`
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
	auditOpenFoodFactsNutrientMappings,
	createOpenFoodFactsPendingMappingRows,
} from "../../lib/nutrition/openFoodFactsNutrientMappingAudit.mjs";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const apply = process.argv.includes("--apply");
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
	throw new Error(
		"PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
	);
}

const taxonomyResponse = await fetch(
	"https://static.openfoodfacts.org/data/taxonomies/nutrients.json",
	{
		headers: {
			accept: "application/json",
			"user-agent": "blendCalc Open Food Facts nutrient mapping candidate seed",
		},
		signal: AbortSignal.timeout(30_000),
	},
);
if (!taxonomyResponse.ok) {
	throw new Error(
		`Open Food Facts nutrient taxonomy returned ${taxonomyResponse.status}.`,
	);
}
const taxonomy = await taxonomyResponse.json();
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

const observedAt = new Date().toISOString();
const audit = auditOpenFoodFactsNutrientMappings({
	taxonomy,
	mappings: mappingsResult.data ?? [],
	observations: observationsResult.data ?? [],
	definitions: definitionsResult.data ?? [],
	preferredNutrientIds: new Set(
		(preferredResult.data ?? []).map((row) => Number(row.nutrient_id)),
	),
});
const candidates = createOpenFoodFactsPendingMappingRows(audit, observedAt);

console.table([
	{
		Mode: apply ? "apply" : "preview",
		"Taxonomy nutrients": audit.taxonomyNutrientCount,
		"Observed identities": audit.observedIdentityCount,
		"New observed review candidates": candidates.length,
		"Observed unsupported": audit.counts.observedUnsupported,
	},
]);

if (apply && candidates.length > 0) {
	for (let offset = 0; offset < candidates.length; offset += 500) {
		const { error } = await supabase
			.from("nutrient_source_mappings")
			.upsert(candidates.slice(offset, offset + 500), {
				onConflict: "source_key,source_nutrient_key,source_unit_name",
				ignoreDuplicates: true,
			});
		if (error) throw error;
	}
	console.log(
		`Queued ${candidates.length} candidates for private mapping review.`,
	);
} else if (!apply) {
	console.log(
		"Preview only. Add --apply to enqueue observed candidates. Taxonomy-only candidates remain in the audit report.",
	);
}

supabase.realtime.disconnect();
