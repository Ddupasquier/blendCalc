type JsonRecord = Record<string, unknown>;

export type CatalogMonitorModerationSummary = {
	settings: {
		enabled: boolean;
		productBatchSize: number;
		safetyAlertPageSize: number;
		lastInvocationRequestedAt: string | null;
		lastInvocationRequestId: number | null;
		lastInvocationError: string | null;
	};
	queue: {
		dueProducts: number;
		retryingProducts: number;
		pendingProviderChanges: number;
		pendingSafetyMatches: number;
		activeSafetyMatches: number;
	};
	recentRuns: Array<{
		id: string;
		status: string;
		invocationSource: string;
		startedAt: string;
		finishedAt: string | null;
		productJobsClaimed: number;
		productJobsChanged: number;
		productJobsFailed: number;
		safetyAlertsObserved: number;
		safetyAlertsChanged: number;
		safetyMatchesActivated: number;
		errors: unknown[];
	}>;
	providerChanges: Array<{
		id: string;
		sharedProductId: string;
		barcode: string;
		productName: string;
		sourceName: string;
		changeSummary: { changes: Array<{ field: string; label: string; severity: string }> };
		materialFieldPaths: string[];
		observedAt: string;
		createdAt: string;
	}>;
	safetyMatches: Array<{
		id: string;
		sharedProductId: string;
		barcode: string;
		productName: string;
		brandOwner: string | null;
		alertProductDescription: string;
		classification: string | null;
		reason: string | null;
		packageDescription: string | null;
		codeInformation: string | null;
		sourceUrl: string;
		sourceName: string;
		matchEvidence: JsonRecord;
		requiresPackageCheck: boolean;
		detectedAt: string;
	}>;
};

export const createUnavailableCatalogMonitorModerationSummary =
	(): CatalogMonitorModerationSummary => ({
		settings: {
			enabled: false,
			productBatchSize: 0,
			safetyAlertPageSize: 0,
			lastInvocationRequestedAt: null,
			lastInvocationRequestId: null,
			lastInvocationError: null,
		},
		queue: {
			dueProducts: 0,
			retryingProducts: 0,
			pendingProviderChanges: 0,
			pendingSafetyMatches: 0,
			activeSafetyMatches: 0,
		},
		recentRuns: [],
		providerChanges: [],
		safetyMatches: [],
	});

const record = (value: unknown, field: string): JsonRecord => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new TypeError(`Invalid catalog monitor field: ${field}`);
	}
	return value as JsonRecord;
};
const array = (value: unknown, field: string) => {
	if (!Array.isArray(value)) throw new TypeError(`Invalid catalog monitor field: ${field}`);
	return value;
};
const string = (value: unknown, field: string) => {
	if (typeof value !== "string") throw new TypeError(`Invalid catalog monitor field: ${field}`);
	return value;
};
const nullableString = (value: unknown, field: string) =>
	value === null ? null : string(value, field);
const number = (value: unknown, field: string) => {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new TypeError(`Invalid catalog monitor field: ${field}`);
	}
	return value;
};
const nullableNumber = (value: unknown, field: string) =>
	value === null ? null : number(value, field);
const boolean = (value: unknown, field: string) => {
	if (typeof value !== "boolean") throw new TypeError(`Invalid catalog monitor field: ${field}`);
	return value;
};

export const parseCatalogMonitorModerationSummary = (
	value: unknown,
): CatalogMonitorModerationSummary => {
	const root = record(value, "root");
	const settings = record(root.settings, "settings");
	const queue = record(root.queue, "queue");
	return {
		settings: {
			enabled: boolean(settings.enabled, "settings.enabled"),
			productBatchSize: number(settings.productBatchSize, "settings.productBatchSize"),
			safetyAlertPageSize: number(settings.safetyAlertPageSize, "settings.safetyAlertPageSize"),
			lastInvocationRequestedAt: nullableString(settings.lastInvocationRequestedAt, "settings.lastInvocationRequestedAt"),
			lastInvocationRequestId: nullableNumber(settings.lastInvocationRequestId, "settings.lastInvocationRequestId"),
			lastInvocationError: nullableString(settings.lastInvocationError, "settings.lastInvocationError"),
		},
		queue: {
			dueProducts: number(queue.dueProducts, "queue.dueProducts"),
			retryingProducts: number(queue.retryingProducts, "queue.retryingProducts"),
			pendingProviderChanges: number(queue.pendingProviderChanges, "queue.pendingProviderChanges"),
			pendingSafetyMatches: number(queue.pendingSafetyMatches, "queue.pendingSafetyMatches"),
			activeSafetyMatches: number(queue.activeSafetyMatches, "queue.activeSafetyMatches"),
		},
		recentRuns: array(root.recentRuns, "recentRuns").map((value, index) => {
			const path = `recentRuns[${index}]`;
			const run = record(value, path);
			return {
				id: string(run.id, `${path}.id`),
				status: string(run.status, `${path}.status`),
				invocationSource: string(run.invocationSource, `${path}.invocationSource`),
				startedAt: string(run.startedAt, `${path}.startedAt`),
				finishedAt: nullableString(run.finishedAt, `${path}.finishedAt`),
				productJobsClaimed: number(run.productJobsClaimed, `${path}.productJobsClaimed`),
				productJobsChanged: number(run.productJobsChanged, `${path}.productJobsChanged`),
				productJobsFailed: number(run.productJobsFailed, `${path}.productJobsFailed`),
				safetyAlertsObserved: number(run.safetyAlertsObserved, `${path}.safetyAlertsObserved`),
				safetyAlertsChanged: number(run.safetyAlertsChanged, `${path}.safetyAlertsChanged`),
				safetyMatchesActivated: number(run.safetyMatchesActivated, `${path}.safetyMatchesActivated`),
				errors: array(run.errors, `${path}.errors`),
			};
		}),
		providerChanges: array(root.providerChanges, "providerChanges").map((value, index) => {
			const path = `providerChanges[${index}]`;
			const change = record(value, path);
			const summary = record(change.changeSummary, `${path}.changeSummary`);
			return {
				id: string(change.id, `${path}.id`),
				sharedProductId: string(change.sharedProductId, `${path}.sharedProductId`),
				barcode: string(change.barcode, `${path}.barcode`),
				productName: string(change.productName, `${path}.productName`),
				sourceName: string(change.sourceName, `${path}.sourceName`),
				changeSummary: {
					changes: array(summary.changes, `${path}.changeSummary.changes`).map((value, changeIndex) => {
						const detailPath = `${path}.changeSummary.changes[${changeIndex}]`;
						const detail = record(value, detailPath);
						return {
							field: string(detail.field, `${detailPath}.field`),
							label: string(detail.label, `${detailPath}.label`),
							severity: string(detail.severity, `${detailPath}.severity`),
						};
					}),
				},
				materialFieldPaths: array(change.materialFieldPaths, `${path}.materialFieldPaths`).map((entry, entryIndex) => string(entry, `${path}.materialFieldPaths[${entryIndex}]`)),
				observedAt: string(change.observedAt, `${path}.observedAt`),
				createdAt: string(change.createdAt, `${path}.createdAt`),
			};
		}),
		safetyMatches: array(root.safetyMatches, "safetyMatches").map((value, index) => {
			const path = `safetyMatches[${index}]`;
			const match = record(value, path);
			return {
				id: string(match.id, `${path}.id`),
				sharedProductId: string(match.sharedProductId, `${path}.sharedProductId`),
				barcode: string(match.barcode, `${path}.barcode`),
				productName: string(match.productName, `${path}.productName`),
				brandOwner: nullableString(match.brandOwner, `${path}.brandOwner`),
				alertProductDescription: string(match.alertProductDescription, `${path}.alertProductDescription`),
				classification: nullableString(match.classification, `${path}.classification`),
				reason: nullableString(match.reason, `${path}.reason`),
				packageDescription: nullableString(match.packageDescription, `${path}.packageDescription`),
				codeInformation: nullableString(match.codeInformation, `${path}.codeInformation`),
				sourceUrl: string(match.sourceUrl, `${path}.sourceUrl`),
				sourceName: string(match.sourceName, `${path}.sourceName`),
				matchEvidence: record(match.matchEvidence, `${path}.matchEvidence`),
				requiresPackageCheck: boolean(match.requiresPackageCheck, `${path}.requiresPackageCheck`),
				detectedAt: string(match.detectedAt, `${path}.detectedAt`),
			};
		}),
	};
};
