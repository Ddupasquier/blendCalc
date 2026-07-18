import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const daysArgument = process.argv.find((argument) => argument.startsWith("--days="));
const originArgument = process.argv.find((argument) => argument.startsWith("--origin="));
const days = Math.max(1, Number.parseInt(daysArgument?.split("=")[1] ?? "30", 10));
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

const since = new Date();
since.setUTCDate(since.getUTCDate() - days + 1);
const sinceDate = since.toISOString().slice(0, 10);

const [{ data: metricRows, error: metricError }, { data: sources, error: sourceError }] =
	await Promise.all([
		supabase
			.from("product_source_daily_metrics")
			.select("*")
			.gte("metric_date", sinceDate)
			.eq("lookup_origin", origin),
		supabase
			.from("product_data_sources")
			.select("key, display_name"),
	]);

if (metricError) throw metricError;
if (sourceError) throw sourceError;

const sourceNames = new Map((sources ?? []).map((source) => [source.key, source.display_name]));
const totals = new Map();
const numericFields = [
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

for (const row of metricRows ?? []) {
	const total = totals.get(row.source_key) ?? Object.fromEntries(
		numericFields.map((field) => [field, 0]),
	);
	for (const field of numericFields) total[field] += Number(row[field] ?? 0);
	totals.set(row.source_key, total);
}

const percentage = (numerator, denominator) =>
	denominator > 0 ? (numerator / denominator) * 100 : 0;
const rounded = (value, digits = 1) => Number(value.toFixed(digits));

const report = [...totals.entries()].map(([sourceKey, total]) => {
	const matchRate = percentage(total.match_count, total.lookup_count);
	const reliabilityRate = percentage(
		total.completed_lookup_count,
		total.lookup_count,
	);
	const averageNutrients = total.evaluated_product_count > 0
		? total.reported_nutrient_total / total.evaluated_product_count
		: 0;
	const metadataFields =
		total.brand_present_count
		+ total.category_present_count
		+ total.serving_present_count
		+ total.ingredients_present_count
		+ total.image_present_count;
	const metadataCoverage = percentage(
		metadataFields,
		total.evaluated_product_count * 5,
	);
	const coverageIndex =
		(matchRate * 0.35)
		+ (reliabilityRate * 0.15)
		+ (Math.min(averageNutrients / 20, 1) * 100 * 0.25)
		+ (metadataCoverage * 0.25);

	return {
		Source: sourceNames.get(sourceKey) ?? sourceKey,
		Lookups: total.lookup_count,
		"API calls": total.api_request_count,
		"Cache hits": total.cache_hit_count,
		"API errors": total.api_error_count,
		"Match %": rounded(matchRate),
		"Exact barcode": total.exact_barcode_match_count,
		"Avg nutrients": rounded(averageNutrients),
		"Metadata %": rounded(metadataCoverage),
		"Avg ms": rounded(
			total.response_milliseconds_total / Math.max(total.lookup_count, 1),
			0,
		),
		"Coverage index": rounded(coverageIndex),
	};
}).sort((left, right) => right["Coverage index"] - left["Coverage index"]);

console.log(`Product source quality: ${sinceDate} through today (${origin})`);
if (report.length === 0) {
	console.log("No source metrics have been recorded in this period yet.");
} else {
	console.table(report);
}
console.log(
	"Coverage index measures observed match/fullness/reliability, not authority. Runtime fallback sources receive harder requests, so use benchmark-origin rows for direct source comparisons.",
);
