import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type {
	CatalogMonitorRunSummary,
	CatalogMonitorSettings,
	CatalogRevalidationJob,
	CatalogSafetyMatchCandidate,
	JsonObject,
	NormalizedOfficialSafetyAlert,
	NormalizedProviderSnapshot,
	OfficialSafetyAlertIdentifier,
	ProbableSafetyAlertMatch,
	ProviderSnapshotChange,
	SafetyAlertIngestionClaim,
} from "./types.ts";

const requireData = <Value>(
	response: { data: Value | null; error: { message: string } | null },
	operation: string,
) => {
	if (response.error) throw new Error(`${operation}: ${response.error.message}`);
	if (response.data === null) throw new Error(`${operation}: no data returned`);
	return response.data;
};

export class CatalogMonitorRepository {
	constructor(private readonly supabase: SupabaseClient) {}

	async readSettings(): Promise<CatalogMonitorSettings> {
		const response = await this.supabase
			.from("catalog_monitor_settings")
			.select("enabled, product_batch_size, safety_alert_page_size")
			.eq("id", true)
			.single();
		return requireData(response, "Read catalog monitor settings") as CatalogMonitorSettings;
	}

	async startRun(invocationSource: "cron" | "manual" | "test") {
		const response = await this.supabase
			.from("catalog_monitor_runs")
			.insert({ invocation_source: invocationSource })
			.select("id")
			.single();
		return (requireData(response, "Start catalog monitor run") as { id: string }).id;
	}

	async finishRun(runId: string, summary: CatalogMonitorRunSummary) {
		const successfulOperations =
			summary.productJobsUnchanged +
			summary.productJobsChanged +
			summary.safetyAlertsObserved;
		const status = summary.errors.length === 0
			? "completed"
			: successfulOperations > 0
				? "partial"
				: "failed";
		const response = await this.supabase
			.from("catalog_monitor_runs")
			.update({
				status,
				finished_at: new Date().toISOString(),
				product_jobs_claimed: summary.productJobsClaimed,
				product_jobs_unchanged: summary.productJobsUnchanged,
				product_jobs_changed: summary.productJobsChanged,
				product_jobs_failed: summary.productJobsFailed,
				safety_alerts_observed: summary.safetyAlertsObserved,
				safety_alerts_changed: summary.safetyAlertsChanged,
				safety_matches_activated: summary.safetyMatchesActivated,
				error_summary: summary.errors,
			})
			.eq("id", runId);
		if (response.error) throw new Error(`Finish catalog monitor run: ${response.error.message}`);
	}

	async claimProductJobs(runId: string, limit: number) {
		const response = await this.supabase.rpc("claim_catalog_revalidation_jobs", {
			p_run_id: runId,
			p_limit: limit,
		});
		return requireData(response, "Claim catalog revalidation jobs") as CatalogRevalidationJob[];
	}

	async completeProductJob(
		job: CatalogRevalidationJob,
		result:
			| "baseline"
			| "unchanged"
			| "changed"
			| "not_found"
			| "rate_limited"
			| "provider_unavailable"
			| "invalid_response"
			| "skipped",
		errorCode?: string,
	) {
		const response = await this.supabase.rpc("complete_catalog_revalidation_job", {
			p_queue_id: job.id,
			p_claim_token: job.claim_token,
			p_result: result,
			p_error_code: errorCode ?? null,
		});
		if (response.error) throw new Error(`Complete catalog revalidation job: ${response.error.message}`);
	}

	async confirmProviderMetadataUnchanged(
		job: CatalogRevalidationJob,
		providerRevision: string | null,
		providerUpdatedAt: string | null,
	) {
		const response = await this.supabase.rpc(
			"confirm_catalog_provider_metadata_unchanged",
			{
				p_queue_id: job.id,
				p_claim_token: job.claim_token,
				p_provider_revision: providerRevision,
				p_provider_updated_at: providerUpdatedAt,
				p_observed_at: new Date().toISOString(),
			},
		);
		return requireData(response, "Confirm provider metadata") === true;
	}

	async readLatestProviderSnapshot(job: CatalogRevalidationJob) {
		const response = await this.supabase
			.from("catalog_provider_product_snapshots")
			.select("normalized_snapshot")
			.eq("shared_product_id", job.shared_product_id)
			.eq("provider_key", job.provider_key)
			.order("observed_at", { ascending: false })
			.order("created_at", { ascending: false })
			.limit(1)
			.maybeSingle();
		if (response.error) throw new Error(`Read latest provider snapshot: ${response.error.message}`);
		return response.data?.normalized_snapshot as NormalizedProviderSnapshot | null ?? null;
	}

	async recordProviderSnapshot(
		job: CatalogRevalidationJob,
		snapshot: {
			rawPayload: JsonObject;
			normalizedSnapshot: NormalizedProviderSnapshot;
			contentHash: string;
			providerRevision: string | null;
			providerUpdatedAt: string | null;
		},
		changes: ProviderSnapshotChange[],
	) {
		const response = await this.supabase.rpc("record_catalog_provider_snapshot", {
			p_queue_id: job.id,
			p_claim_token: job.claim_token,
			p_raw_payload: snapshot.rawPayload,
			p_normalized_snapshot: snapshot.normalizedSnapshot,
			p_content_hash: snapshot.contentHash,
			p_provider_revision: snapshot.providerRevision,
			p_provider_updated_at: snapshot.providerUpdatedAt,
			p_observed_at: new Date().toISOString(),
			p_changes: changes,
		});
		return requireData(response, "Record provider snapshot") as
			| "baseline"
			| "unchanged"
			| "changed";
	}

	async claimSafetyAlertSources(runId: string) {
		const response = await this.supabase.rpc("claim_safety_alert_ingestion_sources", {
			p_run_id: runId,
			p_limit: 2,
		});
		return requireData(response, "Claim food safety alert sources") as SafetyAlertIngestionClaim[];
	}

	async completeSafetyAlertSource(
		claim: SafetyAlertIngestionClaim,
		success: boolean,
		cursor: JsonObject,
		sourceUpdatedAt: string | null,
		errorCode?: string,
	) {
		const response = await this.supabase.rpc("complete_safety_alert_ingestion_source", {
			p_provider_key: claim.provider_key,
			p_claim_token: claim.claim_token,
			p_success: success,
			p_cursor_value: cursor,
			p_source_updated_at: sourceUpdatedAt,
			p_error_code: errorCode ?? null,
		});
		if (response.error) throw new Error(`Complete food safety alert source: ${response.error.message}`);
	}

	async readSafetyMatchCandidates() {
		const response = await this.supabase
			.from("shared_products")
			.select("id, barcode, product_name, brand_owner, food")
			.eq("status", "active")
			.order("id")
			.limit(1000);
		return requireData(response, "Read food safety match candidates") as CatalogSafetyMatchCandidate[];
	}

	async recordOfficialSafetyAlert(
		providerKey: SafetyAlertIngestionClaim["provider_key"],
		rawPayload: JsonObject,
		normalizedAlert: NormalizedOfficialSafetyAlert,
		contentHash: string,
		identifiers: OfficialSafetyAlertIdentifier[],
		probableMatches: ProbableSafetyAlertMatch[],
	) {
		const response = await this.supabase.rpc("record_official_food_safety_alert", {
			p_provider_key: providerKey,
			p_alert: normalizedAlert,
			p_raw_payload: rawPayload,
			p_normalized_payload: normalizedAlert,
			p_content_hash: contentHash,
			p_identifiers: identifiers,
			p_probable_matches: probableMatches,
			p_observed_at: new Date().toISOString(),
		});
		const result = requireData(response, "Record official food safety alert") as Array<{
			content_changed: boolean;
			exact_matches_activated: number;
			probable_matches_queued: number;
		}>;
		return result[0] ?? {
			content_changed: false,
			exact_matches_activated: 0,
			probable_matches_queued: 0,
		};
	}
}
