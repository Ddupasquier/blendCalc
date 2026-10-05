/**
 * Purpose: Check BlendCalc's isolated publication read model has an active generation
 * and usable product detail/search payloads. Reads only; does not launch services.
 * Run: `node scripts/operations/quality/prove_local_publication.mjs` with the package's
 * REHEARSAL_DEPENDENT_PUBLICATION_API_ENV_FILE pointing to an owner-only local file.
 */

import { readFile, stat } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

try {
	const file = process.env.REHEARSAL_DEPENDENT_PUBLICATION_API_ENV_FILE;
	if (!file || ((await stat(file)).mode & 0o077) !== 0) throw new Error();
	const environment = parseEnv(await readFile(file, "utf8"));
	const url = new URL(environment.SUPABASE_URL);
	if (url.hostname !== "127.0.0.1" || url.port !== "59321") throw new Error();
	const client = createClient(
		url.origin,
		environment.SUPABASE_SERVICE_ROLE_KEY,
		{
			auth: { persistSession: false, autoRefreshToken: false },
		},
	);
	const generation = await client
		.schema("blendcalc_api")
		.from("publication_generations")
		.select("id")
		.eq("status", "active")
		.single();
	if (generation.error || !generation.data) throw new Error();
	const products = await client
		.schema("blendcalc_api")
		.from("publication_products")
		.select("gtin14,detail_payload,search_payload")
		.eq("generation_id", generation.data.id)
		.order("gtin14")
		.limit(3);
	if (
		products.error ||
		products.data.length !== 3 ||
		products.data.some(
			(product) =>
				!/^\d{14}$/u.test(product.gtin14) ||
				!product.detail_payload?.id ||
				!product.search_payload?.id,
		)
	)
		throw new Error();
	console.log(
		"Publication read model: active generation and three detail/search payloads passed.",
	);
} catch {
	console.error(
		"Local publication proof failed; check local configuration and the active published corpus.",
	);
	process.exitCode = 1;
}
