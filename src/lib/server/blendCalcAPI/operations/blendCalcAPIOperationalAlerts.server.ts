import type { readBlendCalcAPIOperationsDashboard } from "./blendCalcAPIOperations.server";

type OperationsDashboard = Awaited<
	ReturnType<typeof readBlendCalcAPIOperationsDashboard>
>;

export type BlendCalcAPIOperationalAlert = {
	code:
		| "catalog_intake_backlog"
		| "catalog_intake_stuck"
		| "cutover_verification_failed"
		| "database_failures"
		| "key_usage_anomaly"
		| "operations_dashboard_unavailable"
		| "publication_hold_removal_propagation_failed"
		| "publication_integrity_failed"
		| "publication_sync_failed"
		| "publication_sync_stale"
		| "publication_zero_products"
		| "request_error_rate"
		| "request_latency"
		| "rollback_verification_failed"
		| "shadow_read_divergence";
	severity: "critical" | "warning";
	summary: string;
	title: string;
};

const LATENCY_BUDGET_MS: Record<string, number> = {
	categories: 750,
	product: 1_000,
	revisions: 1_000,
	search: 1_000,
	unknown: 1_000,
};
const MINIMUM_LATENCY_SAMPLE = 20;
const MAXIMUM_SYNC_AGE_MS = 45 * 60 * 1_000;
const MAXIMUM_INTAKE_AGE_MS = 24 * 60 * 60 * 1_000;

const finiteNumber = (value: unknown) => {
	const parsed = typeof value === "number" ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

const ageMilliseconds = (timestamp: string | null | undefined, now: Date) => {
	if (!timestamp) return Number.POSITIVE_INFINITY;
	const parsed = Date.parse(timestamp);
	return Number.isFinite(parsed)
		? Math.max(0, now.getTime() - parsed)
		: Number.POSITIVE_INFINITY;
};

const recentRun = (
	dashboard: OperationsDashboard,
	operation: "rollback" | "synchronize",
) =>
	dashboard.recentPublicationRuns.find((run) => run.operation === operation) ??
	null;

export const evaluateBlendCalcAPIOperationalAlerts = (
	dashboard: OperationsDashboard,
	now = new Date(),
): BlendCalcAPIOperationalAlert[] => {
	const alerts = new Map<
		BlendCalcAPIOperationalAlert["code"],
		BlendCalcAPIOperationalAlert
	>();
	const add = (alert: BlendCalcAPIOperationalAlert) => {
		if (!alerts.has(alert.code)) alerts.set(alert.code, alert);
	};
	const oneHourRequests = dashboard.requests.filter(
		(row) => row.window_name === "1 hour",
	);
	const requestCount = oneHourRequests.reduce(
		(total, row) => total + finiteNumber(row.request_count),
		0,
	);
	const serverErrorCount = oneHourRequests.reduce(
		(total, row) => total + finiteNumber(row.server_error_count),
		0,
	);

	if (
		requestCount >= 20 &&
		serverErrorCount >= 5 &&
		serverErrorCount / requestCount >= 0.05
	) {
		add({
			code: "request_error_rate",
			severity: "critical",
			title: "Sustained API server errors",
			summary: `${serverErrorCount} of ${requestCount} requests failed during the last hour.`,
		});
	}

	const slowOperations = oneHourRequests
		.filter(
			(row) =>
				finiteNumber(row.request_count) >= MINIMUM_LATENCY_SAMPLE &&
				finiteNumber(row.p95_total_duration_ms) >
					(LATENCY_BUDGET_MS[row.operation ?? "unknown"] ?? 1_000),
		)
		.map((row) => row.operation ?? "unknown");
	if (slowOperations.length > 0) {
		add({
			code: "request_latency",
			severity: "warning",
			title: "Sustained API latency regression",
			summary: `The hourly p95 exceeded its budget for: ${slowOperations.join(", ")}.`,
		});
	}

	const recentDatabaseFailures = dashboard.requests
		.filter((row) => row.window_name === "15 minutes")
		.reduce(
			(total, row) => total + finiteNumber(row.database_failure_count),
			0,
		);
	if (recentDatabaseFailures >= 3) {
		add({
			code: "database_failures",
			severity: "critical",
			title: "Repeated API database failures",
			summary: `${recentDatabaseFailures} database reads failed during the last 15 minutes.`,
		});
	}

	const keyUsage = dashboard.alertWindows.keyUsage.find(
		(row) => row.window_name === "15 minutes",
	);
	if (
		finiteNumber(keyUsage?.max_requests_per_key) >= 1_200 ||
		finiteNumber(keyUsage?.max_denied_per_key) >= 10
	) {
		add({
			code: "key_usage_anomaly",
			severity: "warning",
			title: "Unusual API-key activity",
			summary: `One pseudonymous key reached ${finiteNumber(keyUsage?.max_requests_per_key)} requests and ${finiteNumber(keyUsage?.max_denied_per_key)} denials in 15 minutes.`,
		});
	}

	const oldestPendingAge = ageMilliseconds(
		dashboard.intake.oldestPendingSubmissionAt,
		now,
	);
	if (
		dashboard.intake.pendingSubmissionCount >= 50 ||
		(dashboard.intake.oldestPendingSubmissionAt !== null &&
			oldestPendingAge > MAXIMUM_INTAKE_AGE_MS)
	) {
		const oldestWait = Number.isFinite(oldestPendingAge)
			? `${Math.floor(oldestPendingAge / 3_600_000)} hours`
			: "an unavailable duration";
		add({
			code: "catalog_intake_backlog",
			severity: "warning",
			title: "Catalog intake backlog needs review",
			summary: `${dashboard.intake.pendingSubmissionCount} submissions are pending; the oldest has waited ${oldestWait}.`,
		});
	}
	if (dashboard.intake.stuckRequestCount > 0) {
		add({
			code: "catalog_intake_stuck",
			severity: "critical",
			title: "Catalog intake requests are stuck",
			summary: `${dashboard.intake.stuckRequestCount} idempotent intake requests have remained processing for more than 15 minutes.`,
		});
	}

	const publication = dashboard.publication;
	if (!publication) {
		add({
			code: "publication_integrity_failed",
			severity: "critical",
			title: "No active API publication generation",
			summary: "The publication database returned no active generation.",
		});
	} else {
		if (
			publication.counts_match !== true ||
			publication.hashes_match !== true
		) {
			add({
				code: "publication_integrity_failed",
				severity: "critical",
				title: "API publication parity failed",
				summary:
					"Source and target publication counts or content hashes do not match.",
			});
		}
		if (finiteNumber(publication.target_product_count) === 0) {
			add({
				code: "publication_zero_products",
				severity: "critical",
				title: "API publication contains zero products",
				summary:
					"The active publication generation unexpectedly contains no products.",
			});
		}
		if (
			finiteNumber(publication.latest_removed_product_count) > 0 &&
			(publication.counts_match !== true || publication.hashes_match !== true)
		) {
			add({
				code: "publication_hold_removal_propagation_failed",
				severity: "critical",
				title: "Publication removal propagation failed",
				summary:
					"A generation containing removals did not preserve source/target count and hash parity.",
			});
		}
		if (
			ageMilliseconds(publication.latest_sync_started_at, now) >
			MAXIMUM_SYNC_AGE_MS
		) {
			add({
				code: "publication_sync_stale",
				severity: "critical",
				title: "Publication synchronization is stale",
				summary:
					"No publication synchronization started during the last 45 minutes.",
			});
		}
		if (publication.latest_sync_status === "failed") {
			add({
				code: "publication_sync_failed",
				severity: "critical",
				title: "Publication synchronization failed",
				summary: `The latest synchronization failed${publication.latest_sync_failure_code ? ` with ${publication.latest_sync_failure_code}` : ""}.`,
			});
		}
		if (
			dashboard.currentReadMode !== "source" &&
			publication.latest_request_observed_at &&
			ageMilliseconds(publication.latest_request_observed_at, now) <=
				60 * 60 * 1_000 &&
			publication.latest_production_read_mode !== dashboard.currentReadMode
		) {
			add({
				code: "cutover_verification_failed",
				severity: "critical",
				title: "API cutover verification failed",
				summary: `Configured read mode is ${dashboard.currentReadMode}, but the latest production observation used ${publication.latest_production_read_mode ?? "an unknown mode"}.`,
			});
		}
	}

	const parityFailures = dashboard.alertWindows.shadowParity
		.filter((row) => row.window_name === "15 minutes")
		.reduce((total, row) => total + finiteNumber(row.failure_count), 0);
	if (parityFailures > 0) {
		add({
			code: "shadow_read_divergence",
			severity: "critical",
			title: "Shadow reads diverged",
			summary: `${parityFailures} source/target comparisons diverged during the last 15 minutes.`,
		});
	}

	const failedSync = recentRun(dashboard, "synchronize");
	if (failedSync?.status === "failed") {
		add({
			code: "publication_sync_failed",
			severity: "critical",
			title: "Publication generation failed",
			summary: "The latest recorded publication generation did not complete.",
		});
	}
	const rollback = recentRun(dashboard, "rollback");
	if (
		rollback &&
		ageMilliseconds(rollback.started_at, now) <= 24 * 60 * 60 * 1_000 &&
		(rollback.status !== "succeeded" || rollback.outcome !== "rolled-back")
	) {
		add({
			code: "rollback_verification_failed",
			severity: "critical",
			title: "Publication rollback verification failed",
			summary:
				"The latest rollback run did not finish with a verified rolled-back outcome.",
		});
	}

	return [...alerts.values()].sort((left, right) =>
		left.code.localeCompare(right.code),
	);
};
