import type { CatalogMonitorModerationSummary } from "$lib/utils/moderation/catalogMonitorModeration";

export const catalogMonitorModerationFixture: CatalogMonitorModerationSummary = {
	settings: {
		enabled: true,
		productBatchSize: 10,
		safetyAlertPageSize: 100,
		lastInvocationRequestedAt: "2026-08-14T12:00:00.000Z",
		lastInvocationRequestId: 42,
		lastInvocationError: null,
	},
	queue: {
		dueProducts: 3,
		retryingProducts: 1,
		pendingProviderChanges: 1,
		pendingSafetyMatches: 1,
		activeSafetyMatches: 2,
	},
	recentRuns: [],
	providerChanges: [],
	safetyMatches: [],
};
