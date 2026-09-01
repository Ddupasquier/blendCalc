import type { BlendCalcAPIIsolatedClient } from "../v1/blendCalcAPIIsolatedClient.server";
import {
	getBlendCalcAPIIsolatedClient,
	readBlendCalcAPIReadMode,
} from "../v1/blendCalcAPIIsolatedClient.server";

export type BlendCalcAPIOperation =
	"categories" | "product" | "revisions" | "search" | "unknown";

export type BlendCalcAPIDatabaseObservation = {
	databaseDurationMs: number;
	resultCount: number;
};

type PublicationRunResult = {
	action: "created" | "unchanged" | "rolled-back";
	generationId: string;
	catalogHash: string;
	counts: { products: number };
	changes: { added: number; removed: number };
};

const logObservationFailure = (kind: string, error: unknown) => {
	console.error("[blendCalcAPI] Operational observation failed", {
		kind,
		errorType: error instanceof Error ? error.name : typeof error,
	});
};

export const readBlendCalcAPIOperation = (
	pathname: string,
): BlendCalcAPIOperation => {
	if (pathname === "/api/v1/categories") return "categories";
	if (pathname === "/api/v1/foods/search") return "search";
	if (/^\/api\/v1\/products\/[^/]+\/revisions$/.test(pathname)) {
		return "revisions";
	}
	if (/^\/api\/v1\/products\/[^/]+$/.test(pathname)) return "product";
	return "unknown";
};

export const observeBlendCalcAPIDatabaseRead = async <Result>(
	locals: App.Locals,
	read: () => Promise<Result>,
	readResultCount: (result: Result) => number,
) => {
	const startedAt = performance.now();
	try {
		const result = await read();
		locals.blendCalcAPIDatabaseObservation = {
			databaseDurationMs: performance.now() - startedAt,
			resultCount: Math.max(0, readResultCount(result)),
		};
		return result;
	} catch (error) {
		locals.blendCalcAPIDatabaseObservation = {
			databaseDurationMs: performance.now() - startedAt,
			resultCount: 0,
		};
		throw error;
	}
};

export const recordBlendCalcAPIRequestObservation = async (input: {
	pathname: string;
	responseStatus: number;
	totalDurationMs: number;
	databaseObservation?: BlendCalcAPIDatabaseObservation;
	cacheValidation: boolean;
}) => {
	try {
		const client = getBlendCalcAPIIsolatedClient();
		const { error } = await client.rpc("record_api_request_observation", {
			p_operation: readBlendCalcAPIOperation(input.pathname),
			p_read_mode: readBlendCalcAPIReadMode(),
			p_response_status: input.responseStatus,
			p_total_duration_ms: Math.max(0, input.totalDurationMs),
			p_database_duration_ms: input.databaseObservation?.databaseDurationMs,
			p_result_count: input.databaseObservation?.resultCount ?? 0,
			p_cache_validation: input.cacheValidation,
			p_cache_not_modified: input.responseStatus === 304,
		});
		if (error) throw error;
	} catch (error) {
		logObservationFailure("request", error);
	}
};

export const recordBlendCalcAPIShadowParityObservation = async (input: {
	operation: Exclude<BlendCalcAPIOperation, "unknown">;
	matches: boolean;
	sourceHash: string;
	targetHash: string | null;
	sourceDurationMs: number;
	targetDurationMs: number | null;
	failureCode: string | null;
}) => {
	try {
		const client = getBlendCalcAPIIsolatedClient();
		const { error } = await client.rpc("record_api_shadow_parity_observation", {
			p_operation: input.operation,
			p_matches: input.matches,
			p_source_hash: input.sourceHash,
			p_source_duration_ms: Math.max(0, input.sourceDurationMs),
			p_target_hash: input.targetHash ?? undefined,
			p_target_duration_ms:
				input.targetDurationMs === null
					? undefined
					: Math.max(0, input.targetDurationMs),
			p_failure_code: input.failureCode ?? undefined,
		});
		if (error) throw error;
	} catch (error) {
		logObservationFailure("shadow-parity", error);
	}
};

export const startBlendCalcAPIPublicationRun = async (
	client: BlendCalcAPIIsolatedClient,
	operation: "synchronize" | "rollback",
) => {
	try {
		const { data, error } = await client
			.from("publication_sync_runs")
			.insert({
				operation,
				read_mode: readBlendCalcAPIReadMode(),
			})
			.select("id")
			.single();
		if (error) throw error;
		return data.id;
	} catch (error) {
		logObservationFailure("publication-run-start", error);
		return null;
	}
};

export const completeBlendCalcAPIPublicationRun = async (
	client: BlendCalcAPIIsolatedClient,
	runId: string | null,
	startedAt: number,
	result: PublicationRunResult,
) => {
	if (!runId) return;
	try {
		const { error } = await client
			.from("publication_sync_runs")
			.update({
				status: "succeeded",
				outcome: result.action,
				generation_id: result.generationId,
				source_catalog_hash: result.catalogHash,
				target_catalog_hash: result.catalogHash,
				source_product_count: result.counts.products,
				target_product_count: result.counts.products,
				added_product_count: result.changes.added,
				removed_product_count: result.changes.removed,
				duration_ms: Math.max(0, performance.now() - startedAt),
				completed_at: new Date().toISOString(),
			})
			.eq("id", runId);
		if (error) throw error;
	} catch (error) {
		logObservationFailure("publication-run-complete", error);
	}
};

export const failBlendCalcAPIPublicationRun = async (
	client: BlendCalcAPIIsolatedClient,
	runId: string | null,
	startedAt: number,
) => {
	if (!runId) return;
	try {
		const { error } = await client
			.from("publication_sync_runs")
			.update({
				status: "failed",
				failure_code: "publication_operation_failed",
				duration_ms: Math.max(0, performance.now() - startedAt),
				completed_at: new Date().toISOString(),
			})
			.eq("id", runId);
		if (error) throw error;
	} catch (error) {
		logObservationFailure("publication-run-fail", error);
	}
};

export const readBlendCalcAPIOperationsDashboard = async () => {
	const client = getBlendCalcAPIIsolatedClient();
	const [publication, requests, parity, runs] = await Promise.all([
		client.from("publication_operations_dashboard").select("*").maybeSingle(),
		client
			.from("api_request_operations_dashboard")
			.select("*")
			.order("window_name")
			.order("operation"),
		client.from("api_shadow_parity_dashboard").select("*").order("operation"),
		client
			.from("publication_sync_runs")
			.select("*")
			.order("started_at", { ascending: false })
			.limit(25),
	]);
	for (const result of [publication, requests, parity, runs]) {
		if (result.error) throw result.error;
	}
	return {
		currentReadMode: readBlendCalcAPIReadMode(),
		publication: publication.data,
		requests: requests.data ?? [],
		shadowParity: parity.data ?? [],
		recentPublicationRuns: runs.data ?? [],
	};
};
