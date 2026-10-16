import { describe, expect, it } from "vitest";
import {
	AD_BREAK_GRACE_MS,
	AD_BREAK_INTERVAL_MS,
	canDisplayAdvertising,
	createAdUsage,
	isAdBreakDue,
	recordAdBreakAttempt,
	recordCompletedAdAction,
	restoreAdUsage,
	type AdContext,
} from "$lib/utils/advertising/adPolicy";

const context: AdContext = {
	eligibility: "supported",
	networkReady: true,
	consentGranted: true,
	advertisingBlocked: false,
	pathname: "/saved",
	visible: true,
	interactionInProgress: false,
	tutorialOpen: false,
	publisherContentAvailable: true,
};
const accumulated = () =>
	Array.from({ length: 10 }).reduce<ReturnType<typeof createAdUsage>>(
		(usage) => recordCompletedAdAction(usage),
		createAdUsage(1_000),
	);

describe("advertising eligibility and safe checkpoints", () => {
	it.each(["/ingredients/fridge", "/ingredients/shopping", "/mix", "/saved"])(
		"allows ordinary %s",
		(pathname) => {
			expect(canDisplayAdvertising({ ...context, pathname })).toBe(true);
		},
	);
	it.each([
		"/",
		"/auth",
		"/auth/callback",
		"/profile",
		"/profile/moderation",
		"/profile/tutorial",
		"/saved/recipe/123",
		"/ingredients/fridge/nutrition/123",
		"/ingredients/fridge/barcode-scanner",
		"/ingredients/fridge/manual-entry",
		"/mix/save",
	])("excludes %s", (pathname) => {
		expect(canDisplayAdvertising({ ...context, pathname })).toBe(false);
	});
	it.each<Partial<AdContext>>([
		{ eligibility: "unknown" },
		{ eligibility: "ad-free" },
		{ networkReady: false },
		{ consentGranted: false },
		{ advertisingBlocked: true },
		{ advertisingBlocked: undefined },
		{ visible: false },
		{ interactionInProgress: true },
		{ tutorialOpen: true },
		{ publisherContentAvailable: false },
	])("suppresses both formats for %o", (change) => {
		expect(canDisplayAdvertising({ ...context, ...change })).toBe(false);
		expect(
			isAdBreakDue(
				accumulated(),
				{ ...context, ...change },
				1_000 + AD_BREAK_GRACE_MS,
			),
		).toBe(false);
	});
});

describe("usage-based ad frequency", () => {
	it("requires both completed use and the initial grace period", () => {
		const now = 1_000 + AD_BREAK_GRACE_MS;
		expect(isAdBreakDue(createAdUsage(1_000), context, now)).toBe(false);
		expect(isAdBreakDue(accumulated(), context, now - 1)).toBe(false);
		expect(isAdBreakDue(accumulated(), context, now)).toBe(true);
	});
	it("resets usage only on a confirmed eligible attempt and caps subsequent breaks", () => {
		const shownAt = 1_000 + AD_BREAK_GRACE_MS;
		const shown = recordAdBreakAttempt(accumulated(), context, shownAt);
		expect(shown.completedActions).toBe(0);
		const reused = { ...shown, completedActions: 10 };
		expect(
			isAdBreakDue(reused, context, shownAt + AD_BREAK_INTERVAL_MS - 1),
		).toBe(false);
		expect(isAdBreakDue(reused, context, shownAt + AD_BREAK_INTERVAL_MS)).toBe(
			true,
		);
	});
	it("does not consume a pending break in an unsafe state or on clock rollback", () => {
		const usage = accumulated();
		expect(
			recordAdBreakAttempt(
				usage,
				{ ...context, interactionInProgress: true },
				999_000,
			),
		).toBe(usage);
		expect(recordAdBreakAttempt(usage, context, 0)).toBe(usage);
		expect(isAdBreakDue(usage, context, NaN)).toBe(false);
	});
	it("bounds accumulated counts and stores no action details", () => {
		let usage = accumulated();
		for (let i = 0; i < 1_000; i++) usage = recordCompletedAdAction(usage);
		expect(usage.completedActions).toBe(10);
		expect(Object.keys(usage).sort()).toEqual([
			"completedActions",
			"lastBreakAt",
			"startedAt",
			"version",
		]);
	});
});

describe("disposable usage recovery", () => {
	it("restores frequency state without accepting persisted entitlement or consent", () => {
		const usage = accumulated();
		expect(
			restoreAdUsage(
				JSON.stringify({
					...usage,
					eligibility: "ad-free",
					consentGranted: true,
					advertisingBlocked: false,
				}),
				999_000,
			),
		).toEqual(usage);
	});
	it.each([
		null,
		"bad",
		"null",
		"[]",
		"{}",
		'{"version":2}',
		JSON.stringify({ ...accumulated(), completedActions: -1 }),
		JSON.stringify({ ...accumulated(), completedActions: 1.5 }),
		JSON.stringify({ ...accumulated(), startedAt: 1e12 }),
		JSON.stringify({ ...accumulated(), lastBreakAt: 1e12 }),
	])("resets corrupt or future state %s", (raw) => {
		expect(restoreAdUsage(raw, 999_000)).toEqual(createAdUsage(999_000));
	});
});
