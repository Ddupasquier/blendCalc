export const AD_BREAK_ACTION_THRESHOLD = 10;
export const AD_BREAK_GRACE_MS = 5 * 60_000;
export const AD_BREAK_INTERVAL_MS = 30 * 60_000;

export type AdEligibility = "unknown" | "supported" | "ad-free";
export type AdFormat = "inline" | "break";

export type AdContext = {
	eligibility: AdEligibility;
	networkReady: boolean;
	consentGranted: boolean;
	advertisingBlocked: boolean;
	pathname: string;
	visible: boolean;
	interactionInProgress: boolean;
	tutorialOpen: boolean;
	publisherContentAvailable: boolean;
};

export type AdUsage = {
	version: 1;
	startedAt: number;
	completedActions: number;
	lastBreakAt: number | null;
};

const AD_ROUTES = new Set([
	"/ingredients/fridge",
	"/ingredients/shopping",
	"/mix",
	"/saved",
]);

export const createAdUsage = (now: number): AdUsage => ({
	version: 1,
	startedAt: now,
	completedActions: 0,
	lastBreakAt: null,
});

/** Usage is disposable device state. Eligibility and consent never come from it. */
export const restoreAdUsage = (raw: string | null, now: number): AdUsage => {
	try {
		const value: unknown = JSON.parse(raw ?? "null");
		if (!value || typeof value !== "object") return createAdUsage(now);
		const candidate = value as Partial<AdUsage>;
		if (
			candidate.version !== 1 ||
			typeof candidate.startedAt !== "number" ||
			!Number.isFinite(candidate.startedAt) ||
			candidate.startedAt < 0 ||
			candidate.startedAt > now ||
			!Number.isSafeInteger(candidate.completedActions) ||
			(candidate.completedActions ?? -1) < 0 ||
			(candidate.lastBreakAt !== null &&
				(typeof candidate.lastBreakAt !== "number" ||
					!Number.isFinite(candidate.lastBreakAt) ||
					candidate.lastBreakAt < candidate.startedAt ||
					candidate.lastBreakAt > now))
		)
			return createAdUsage(now);
		return {
			version: 1,
			startedAt: candidate.startedAt,
			completedActions: Math.min(
				candidate.completedActions!,
				AD_BREAK_ACTION_THRESHOLD,
			),
			lastBreakAt: candidate.lastBreakAt ?? null,
		};
	} catch {
		return createAdUsage(now);
	}
};

export const recordCompletedAdAction = (usage: AdUsage): AdUsage => ({
	...usage,
	completedActions: Math.min(
		AD_BREAK_ACTION_THRESHOLD,
		usage.completedActions + 1,
	),
});

export const canDisplayAdvertising = (context: AdContext): boolean =>
	context.eligibility === "supported" &&
	context.networkReady &&
	context.consentGranted &&
	context.advertisingBlocked === false &&
	context.visible &&
	!context.interactionInProgress &&
	!context.tutorialOpen &&
	context.publisherContentAvailable &&
	AD_ROUTES.has(context.pathname);

export const isAdBreakDue = (
	usage: AdUsage,
	context: AdContext,
	now: number,
): boolean =>
	Number.isFinite(now) &&
	canDisplayAdvertising(context) &&
	usage.completedActions >= AD_BREAK_ACTION_THRESHOLD &&
	now - usage.startedAt >= AD_BREAK_GRACE_MS &&
	(usage.lastBreakAt === null ||
		now - usage.lastBreakAt >= AD_BREAK_INTERVAL_MS);

/** Cap eligible attempts conservatively; this is not an impression or revenue metric. */
export const recordAdBreakAttempt = (
	usage: AdUsage,
	context: AdContext,
	now: number,
): AdUsage =>
	isAdBreakDue(usage, context, now)
		? { ...usage, completedActions: 0, lastBreakAt: now }
		: usage;
