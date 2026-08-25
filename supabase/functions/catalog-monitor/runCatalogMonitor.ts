import { CatalogMonitorRepository } from "./catalogMonitorRepository.ts";
import {
	compareProviderSnapshots,
	fetchOpenFoodFactsMetadata,
	fetchOpenFoodFactsSnapshot,
	fetchUsdaSnapshot,
	ProviderRequestError,
} from "./providerProducts.ts";
import {
	buildProbableSafetyAlertMatches,
	fetchFsisAlertPage,
	fetchOpenFdaAlertPage,
	SafetyAlertRequestError,
} from "./officialSafetyAlerts.ts";
import type {
	CatalogMonitorRunSummary,
	CatalogRevalidationJob,
	SafetyAlertIngestionClaim,
} from "./types.ts";

const emptySummary = (): CatalogMonitorRunSummary => ({
	productJobsClaimed: 0,
	productJobsUnchanged: 0,
	productJobsChanged: 0,
	productJobsFailed: 0,
	safetyAlertsObserved: 0,
	safetyAlertsChanged: 0,
	safetyMatchesActivated: 0,
	errors: [],
});

const errorCode = (error: unknown) => {
	if (error instanceof ProviderRequestError) return error.result;
	if (error instanceof SafetyAlertRequestError) return error.code;
	return "unexpected_error";
};

const processProductJob = async (
	repository: CatalogMonitorRepository,
	job: CatalogRevalidationJob,
	usdaApiKey: string | undefined,
	summary: CatalogMonitorRunSummary,
) => {
	try {
		if (job.provider_key === "open-food-facts") {
			const metadata = await fetchOpenFoodFactsMetadata(job.source_reference);
			if (
				await repository.confirmProviderMetadataUnchanged(
					job,
					metadata.providerRevision,
					metadata.providerUpdatedAt,
				)
			) {
				summary.productJobsUnchanged += 1;
				return;
			}
		}

		if (job.provider_key === "usda" && !usdaApiKey) {
			throw new ProviderRequestError(
				"USDA API key is not configured",
				"provider_unavailable",
			);
		}

		const previousSnapshot = await repository.readLatestProviderSnapshot(job);
		const snapshot =
			job.provider_key === "open-food-facts"
				? await fetchOpenFoodFactsSnapshot(job.source_reference)
				: await fetchUsdaSnapshot(job.source_reference, usdaApiKey!);
		const changes = compareProviderSnapshots(
			previousSnapshot,
			snapshot.normalizedSnapshot,
		);
		const result = await repository.recordProviderSnapshot(
			job,
			snapshot,
			changes,
		);
		if (result === "changed") summary.productJobsChanged += 1;
		else summary.productJobsUnchanged += 1;
	} catch (error) {
		const code = errorCode(error);
		const result =
			error instanceof ProviderRequestError ? error.result : "invalid_response";
		try {
			await repository.completeProductJob(job, result, code);
		} catch {
			// The original provider/repository failure remains the actionable error.
		}
		summary.productJobsFailed += 1;
		summary.errors.push({ scope: `product:${job.provider_key}`, code });
	}
};

const processSafetyAlertSource = async (
	repository: CatalogMonitorRepository,
	claim: SafetyAlertIngestionClaim,
	pageSize: number,
	openFdaApiKey: string | undefined,
	fdaRecallProxyUrl: string | undefined,
	fdaRecallProxySecret: string | undefined,
	summary: CatalogMonitorRunSummary,
) => {
	try {
		const page =
			claim.provider_key === "open-fda-food-enforcement"
				? await fetchOpenFdaAlertPage(
						claim.last_successful_at,
						claim.cursor_value,
						pageSize,
						openFdaApiKey,
						{
							url: fdaRecallProxyUrl,
							secret: fdaRecallProxySecret,
						},
					)
				: await fetchFsisAlertPage();
		for (const sourceError of page.sourceErrors ?? []) {
			summary.errors.push({
				scope: `safety:${claim.provider_key}:${sourceError.source}`,
				code: sourceError.code,
			});
		}
		const candidates = await repository.readSafetyMatchCandidates();
		for (const alert of page.alerts) {
			const probableMatches = buildProbableSafetyAlertMatches(
				alert.normalizedAlert,
				candidates,
			);
			const result = await repository.recordOfficialSafetyAlert(
				page.providerKey,
				alert.rawPayload,
				alert.normalizedAlert,
				alert.contentHash,
				alert.normalizedAlert.identifiers,
				probableMatches,
			);
			summary.safetyAlertsObserved += 1;
			if (result.content_changed) summary.safetyAlertsChanged += 1;
			summary.safetyMatchesActivated += result.exact_matches_activated;
		}
		await repository.completeSafetyAlertSource(
			claim,
			true,
			page.nextCursor,
			page.sourceUpdatedAt,
		);
	} catch (error) {
		const code = errorCode(error);
		try {
			await repository.completeSafetyAlertSource(
				claim,
				false,
				claim.cursor_value,
				null,
				code,
			);
		} catch {
			// The provider/repository error remains the actionable failure.
		}
		summary.errors.push({ scope: `safety:${claim.provider_key}`, code });
	}
};

export const runCatalogMonitor = async (
	repository: CatalogMonitorRepository,
	invocationSource: "cron" | "manual" | "test",
	environment: {
		usdaApiKey?: string;
		openFdaApiKey?: string;
		fdaRecallProxyUrl?: string;
		fdaRecallProxySecret?: string;
	},
) => {
	const settings = await repository.readSettings();
	if (!settings.enabled && invocationSource !== "test") {
		return { status: "disabled" as const, summary: emptySummary() };
	}

	const runId = await repository.startRun(invocationSource);
	const summary = emptySummary();
	try {
		const safetyClaims = await repository.claimSafetyAlertSources(runId);
		for (const claim of safetyClaims) {
			await processSafetyAlertSource(
				repository,
				claim,
				settings.safety_alert_page_size,
				environment.openFdaApiKey,
				environment.fdaRecallProxyUrl,
				environment.fdaRecallProxySecret,
				summary,
			);
		}

		const productJobs = await repository.claimProductJobs(
			runId,
			settings.product_batch_size,
		);
		summary.productJobsClaimed = productJobs.length;
		for (const job of productJobs) {
			await processProductJob(repository, job, environment.usdaApiKey, summary);
		}
	} catch (error) {
		summary.errors.push({ scope: "run", code: errorCode(error) });
	} finally {
		await repository.finishRun(runId, summary);
	}
	return { status: "completed" as const, runId, summary };
};
