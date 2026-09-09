import { describe, expect, it } from "vitest";
import { evaluateBlendCalcAPIOperationalAlerts } from "$lib/server/blendCalcAPI/operations/blendCalcAPIOperationalAlerts.server";

const NOW = new Date("2026-09-08T20:00:00.000Z");

const healthyDashboard = () => ({
	currentReadMode: "source" as "isolated" | "shadow" | "source",
	publication: {
		active_generation_age_seconds: 60,
		active_generation_id: "generation",
		counts_match: true,
		failed_generation_count: 0,
		hashes_match: true,
		latest_added_product_count: 0,
		latest_production_read_mode: "source",
		latest_removed_product_count: 0,
		latest_request_observed_at: NOW.toISOString(),
		latest_sync_duration_ms: 100,
		latest_sync_failure_code: null as string | null,
		latest_sync_outcome: "unchanged",
		latest_sync_run_id: "run",
		latest_sync_started_at: new Date(
			NOW.getTime() - 5 * 60 * 1_000,
		).toISOString(),
		latest_sync_status: "succeeded",
		source_catalog_hash: "a".repeat(64),
		source_product_count: 100,
		target_catalog_hash: "a".repeat(64),
		target_product_count: 100,
	},
	requests: [],
	shadowParity: [],
	alertWindows: { keyUsage: [], shadowParity: [] },
	intake: {
		oldestPendingSubmissionAt: null as string | null,
		pendingSubmissionCount: 0,
		stuckRequestCount: 0,
	},
	recentPublicationRuns: [],
});

describe("blendCalcAPI operational alert evaluation", () => {
	it("keeps a healthy API quiet", () => {
		expect(
			evaluateBlendCalcAPIOperationalAlerts(healthyDashboard() as never, NOW),
		).toEqual([]);
	});

	it("covers every required owner-alert failure family", () => {
		const dashboard = healthyDashboard();
		dashboard.currentReadMode = "isolated";
		dashboard.publication = {
			...dashboard.publication,
			counts_match: false,
			hashes_match: false,
			latest_production_read_mode: "source",
			latest_removed_product_count: 3,
			latest_sync_failure_code: "generation_failed",
			latest_sync_started_at: new Date(
				NOW.getTime() - 60 * 60 * 1_000,
			).toISOString(),
			latest_sync_status: "failed",
			target_product_count: 0,
		};
		dashboard.requests = [
			{
				database_failure_count: 0,
				operation: "product",
				p95_total_duration_ms: 1_500,
				request_count: 100,
				server_error_count: 10,
				window_name: "1 hour",
			},
			{
				database_failure_count: 3,
				operation: "product",
				p95_total_duration_ms: 1_500,
				request_count: 20,
				server_error_count: 3,
				window_name: "15 minutes",
			},
		] as never;
		dashboard.alertWindows = {
			keyUsage: [
				{
					max_denied_per_key: 10,
					max_requests_per_key: 1_200,
					window_name: "15 minutes",
				},
			] as never,
			shadowParity: [{ failure_count: 2, window_name: "15 minutes" }] as never,
		};
		dashboard.intake = {
			oldestPendingSubmissionAt: new Date(
				NOW.getTime() - 25 * 60 * 60 * 1_000,
			).toISOString(),
			pendingSubmissionCount: 50,
			stuckRequestCount: 2,
		};
		dashboard.recentPublicationRuns = [
			{
				operation: "synchronize",
				started_at: NOW.toISOString(),
				status: "failed",
			},
			{
				operation: "rollback",
				outcome: null,
				started_at: NOW.toISOString(),
				status: "failed",
			},
		] as never;

		expect(
			evaluateBlendCalcAPIOperationalAlerts(dashboard as never, NOW).map(
				(alert) => alert.code,
			),
		).toEqual([
			"catalog_intake_backlog",
			"catalog_intake_stuck",
			"cutover_verification_failed",
			"database_failures",
			"key_usage_anomaly",
			"publication_hold_removal_propagation_failed",
			"publication_integrity_failed",
			"publication_sync_failed",
			"publication_sync_stale",
			"publication_zero_products",
			"request_error_rate",
			"request_latency",
			"rollback_verification_failed",
			"shadow_read_divergence",
		]);
	});

	it("does not alert below sustained-error and latency sample boundaries", () => {
		const dashboard = healthyDashboard();
		dashboard.requests = [
			{
				database_failure_count: 2,
				operation: "search",
				p95_total_duration_ms: 2_000,
				request_count: 19,
				server_error_count: 4,
				window_name: "1 hour",
			},
		] as never;
		expect(
			evaluateBlendCalcAPIOperationalAlerts(dashboard as never, NOW),
		).toEqual([]);
	});
});
