import { createHash, randomInt, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import WebSocket from "ws";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error(
		"PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
	);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
	auth: {
		autoRefreshToken: false,
		detectSessionInUrl: false,
		persistSession: false,
	},
	realtime: { transport: WebSocket },
});

const calculateGtinCheckDigit = (body) => {
	const sum = [...body]
		.reverse()
		.reduce(
			(total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1),
			0,
		);
	return String((10 - (sum % 10)) % 10);
};

const body = `099996${String(Date.now()).slice(-5)}${String(randomInt(100)).padStart(2, "0")}`;
const barcode = `${body}${calculateGtinCheckDigit(body)}`;
const sourceReference = `qa:no-serving:${randomUUID()}`;
const rawPayload = {
	description: "Disposable QA source record with no reported serving",
	servingReported: false,
	servingSize: null,
	servingSizeUnit: null,
};
const normalizedFood = {
	fdcId: -randomInt(1, 2_000_000_000),
	description: "Disposable QA No Serving Fixture",
	foodNutrients: [],
	foodServings: [],
	hasSourceServing: false,
	servingSize: 100,
	servingSizeUnit: "g",
};
const contentHash = createHash("sha256")
	.update(JSON.stringify(rawPayload))
	.digest("hex");

let observationId;

try {
	const { data: observation, error: insertError } = await supabase
		.from("shared_product_observations")
		.insert({
			barcode,
			content_hash: contentHash,
			normalized_food: normalizedFood,
			raw_payload: rawPayload,
			source: "usda",
			source_license: "CC0-1.0",
			source_reference: sourceReference,
		})
		.select("id")
		.single();
	if (insertError) throw insertError;
	observationId = observation.id;

	const { count, error: servingError } = await supabase
		.from("food_servings")
		.select("id", { count: "exact", head: true })
		.eq("shared_product_observation_id", observationId);
	if (servingError) throw servingError;
	if ((count ?? 0) !== 0) {
		throw new Error(
			`Explicit no-serving fixture created ${count} normalized serving row(s).`,
		);
	}

	console.log(
		"Passed: an explicit source-reported no-serving observation created zero food_servings rows.",
	);
} finally {
	if (observationId) {
		const { error } = await supabase
			.from("shared_product_observations")
			.delete()
			.eq("id", observationId);
		if (error) {
			console.error(`Fixture cleanup failed for ${observationId}: ${error.message}`);
			process.exitCode = 1;
		}
	}
}
