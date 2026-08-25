import { createClient } from "npm:@supabase/supabase-js@2";
import { CatalogMonitorRepository } from "./catalogMonitorRepository.ts";
import { runCatalogMonitor } from "./runCatalogMonitor.ts";

const jsonResponse = (value: unknown, status = 200) =>
	new Response(JSON.stringify(value), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});

const hashSecret = async (value: string) =>
	new Uint8Array(
		await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
	);

const secretsMatch = async (provided: string, expected: string) => {
	const [providedHash, expectedHash] = await Promise.all([
		hashSecret(provided),
		hashSecret(expected),
	]);
	let difference = 0;
	for (let index = 0; index < expectedHash.length; index++) {
		difference |= providedHash[index] ^ expectedHash[index];
	}
	return difference === 0;
};

Deno.serve(async (request) => {
	if (request.method !== "POST") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}
	const expectedSecret = Deno.env.get("CATALOG_MONITOR_CRON_SECRET") ?? "";
	const providedSecret = request.headers.get("x-catalog-monitor-secret") ?? "";
	if (
		!expectedSecret ||
		!providedSecret ||
		!(await secretsMatch(providedSecret, expectedSecret))
	) {
		return jsonResponse({ error: "Unauthorized" }, 401);
	}

	const supabaseUrl = Deno.env.get("SUPABASE_URL");
	const serviceRoleKey =
		Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
		Deno.env.get("SUPABASE_SECRET_KEY");
	if (!supabaseUrl || !serviceRoleKey) {
		return jsonResponse(
			{ error: "Catalog monitor service configuration is incomplete" },
			503,
		);
	}

	let invocationSource: "cron" | "manual" | "test" = "cron";
	try {
		const body = await request.json();
		if (
			body?.invocationSource === "manual" ||
			body?.invocationSource === "test"
		) {
			invocationSource = body.invocationSource;
		}
	} catch {
		// An empty scheduled request uses the cron source.
	}

	try {
		const supabase = createClient(supabaseUrl, serviceRoleKey, {
			auth: { persistSession: false, autoRefreshToken: false },
		});
		const result = await runCatalogMonitor(
			new CatalogMonitorRepository(supabase),
			invocationSource,
			{
				usdaApiKey: Deno.env.get("USDA_API_KEY"),
				openFdaApiKey: Deno.env.get("OPENFDA_API_KEY"),
				fdaRecallProxyUrl: Deno.env.get("FDA_RECALL_PROXY_URL"),
				fdaRecallProxySecret: Deno.env.get("FDA_RECALL_PROXY_SECRET"),
				fdaRecallProxyProtectionBypassSecret: Deno.env.get(
					"FDA_RECALL_PROXY_PROTECTION_BYPASS_SECRET",
				),
			},
		);
		return jsonResponse(result);
	} catch {
		return jsonResponse(
			{ error: "Catalog monitoring could not complete" },
			500,
		);
	}
});
