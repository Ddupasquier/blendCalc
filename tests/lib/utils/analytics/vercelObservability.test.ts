import { describe, expect, it, vi } from "vitest";
import {
	mountVercelObservability,
	redactObservabilityUrl,
} from "$lib/utils/analytics/vercelObservability";
import {
	APP_PERFORMANCE_TIMING_EVENT,
	SLOW_INTERACTION_THRESHOLD_MS,
} from "$lib/utils/analytics/performanceObservability";
const tick = async () => {
	for (let i = 0; i < 8; i++) await Promise.resolve();
};
const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
};
const setup = (hostname = "blendcalc.food", navigation = "navigate") => {
	const target = Object.assign(new EventTarget(), {
		location: { hostname, pathname: "/ingredients/fridge/private-id" },
	}) as unknown as Window;
	const timing = {
		now: () => 123,
		getEntriesByType: () => [{ type: navigation }],
	} as unknown as Performance;
	const analytics = { injectAnalytics: vi.fn(), track: vi.fn() };
	const insights = { injectSpeedInsights: vi.fn() };
	const pending = deferred<typeof analytics>();
	const loadAnalytics = vi.fn(() => pending.promise),
		loadSpeedInsights = vi.fn(async () => insights);
	let callback!: PerformanceObserverCallback;
	const disconnect = vi.fn(),
		observe = vi.fn();
	class Observer {
		static supportedEntryTypes = ["event"];
		constructor(fn: PerformanceObserverCallback) {
			callback = fn;
		}
		disconnect = disconnect;
		observe = observe;
	}
	const options = {
		browser: true,
		dev: false,
		target,
		timing,
		Observer: Observer as unknown as typeof PerformanceObserver,
		loadAnalytics,
		loadSpeedInsights,
	};
	const event = (name = "fridge_load_more", durationMilliseconds = 456) =>
		target.dispatchEvent(
			new CustomEvent(APP_PERFORMANCE_TIMING_EVENT, {
				detail: { name, durationMilliseconds, privateValue: "secret" },
			}),
		);
	const entries = (duration: number) =>
		callback(
			{ getEntries: () => [{ duration }] } as PerformanceObserverEntryList,
			{} as PerformanceObserver,
		);
	return {
		target,
		options,
		analytics,
		insights,
		pending,
		loadAnalytics,
		loadSpeedInsights,
		disconnect,
		observe,
		event,
		entries,
	};
};
describe("optional production reporting lifecycle", () => {
	it("never loads SDKs for SSR, dev, local or unapproved hosts", async () => {
		for (const context of [
			{ browser: false },
			{ dev: true },
			{ target: setup("localhost").target },
			{ target: setup("preview.vercel.app").target },
		]) {
			const f = setup();
			const cleanup = mountVercelObservability({ ...f.options, ...context });
			await tick();
			expect(f.loadAnalytics).not.toHaveBeenCalled();
			expect(f.loadSpeedInsights).not.toHaveBeenCalled();
			cleanup();
		}
	});
	it("loads approved SDKs asynchronously, preserves early timing/reload and privacy", async () => {
		const f = setup("www.blendcalc.food", "reload");
		const cleanup = mountVercelObservability(f.options);
		expect(f.loadAnalytics).not.toHaveBeenCalled();
		f.event();
		await tick();
		expect(f.loadAnalytics).toHaveBeenCalledTimes(1);
		expect(f.analytics.track).not.toHaveBeenCalled();
		f.pending.resolve(f.analytics);
		await tick();
		expect(f.analytics.injectAnalytics).toHaveBeenCalledWith({
			mode: "production",
			debug: false,
			beforeSend: redactObservabilityUrl,
		});
		expect(f.insights.injectSpeedInsights).toHaveBeenCalledWith({
			debug: false,
			beforeSend: redactObservabilityUrl,
		});
		expect(f.analytics.track.mock.calls).toEqual([
			[
				"app_performance_timing",
				{
					phase: "hydration",
					durationBucket: "100_199ms",
					routeGroup: "ingredients_fridge",
				},
			],
			["page_reload", undefined],
			[
				"app_performance_timing",
				{
					phase: "fridge_load_more",
					durationBucket: "200_499ms",
					routeGroup: "ingredients_fridge",
				},
			],
		]);
		expect(JSON.stringify(f.analytics.track.mock.calls)).not.toMatch(
			/secret|private-id/,
		);
		cleanup();
	});
	it("bounds pending metrics and rejects unregistered/nonfinite timings", async () => {
		const f = setup();
		const cleanup = mountVercelObservability(f.options);
		f.event("unknown");
		f.event("hydration", NaN);
		for (let i = 0; i < 100; i++) f.event();
		f.pending.resolve(f.analytics);
		await tick();
		expect(f.analytics.track).toHaveBeenCalledTimes(32);
		expect(
			f.analytics.track.mock.calls.some((call) => call[0] === "page_reload"),
		).toBe(false);
		cleanup();
	});
	it("observes only the first slow interaction and removes owned listeners", async () => {
		const f = setup();
		const cleanup = mountVercelObservability(f.options);
		expect(f.observe).toHaveBeenCalledWith({ type: "event", buffered: true });
		f.entries(SLOW_INTERACTION_THRESHOLD_MS - 1);
		f.entries(SLOW_INTERACTION_THRESHOLD_MS);
		f.entries(SLOW_INTERACTION_THRESHOLD_MS + 1);
		f.pending.resolve(f.analytics);
		await tick();
		expect(f.analytics.track).toHaveBeenCalledTimes(2);
		cleanup();
		expect(f.disconnect).toHaveBeenCalledTimes(1);
		f.event();
		f.entries(9999);
		expect(f.analytics.track).toHaveBeenCalledTimes(2);
	});
	it("does not invoke deferred import factories after immediate disposal", async () => {
		const f = setup();
		const cleanup = mountVercelObservability(f.options);
		cleanup();
		await tick();
		expect(f.loadAnalytics).not.toHaveBeenCalled();
		expect(f.loadSpeedInsights).not.toHaveBeenCalled();
		expect(f.disconnect).toHaveBeenCalledTimes(1);
	});

	it("does not inject after unmount while loading", async () => {
		const f = setup();
		const speed = deferred<typeof f.insights>();
		const cleanup = mountVercelObservability({
			...f.options,
			loadSpeedInsights: () => speed.promise,
		});
		await tick();
		cleanup();
		f.pending.resolve(f.analytics);
		speed.resolve(f.insights);
		await tick();
		expect(f.analytics.injectAnalytics).not.toHaveBeenCalled();
		expect(f.insights.injectSpeedInsights).not.toHaveBeenCalled();
		expect(f.analytics.track).not.toHaveBeenCalled();
		expect(f.disconnect).toHaveBeenCalledTimes(1);
	});
	it("contains optional rejection without logging or leaking owned listeners", async () => {
		const f = setup();
		const warn = vi.spyOn(console, "warn"),
			error = vi.spyOn(console, "error");
		const cleanup = mountVercelObservability({
			...f.options,
			loadSpeedInsights: async () => {
				throw Error("unavailable");
			},
		});
		f.pending.reject(Error("unavailable"));
		await tick();
		expect(warn).not.toHaveBeenCalled();
		expect(error).not.toHaveBeenCalled();
		cleanup();
		expect(f.disconnect).toHaveBeenCalledTimes(1);
		warn.mockRestore();
		error.mockRestore();
	});
	it("contains SDK injection and subsequent tracking exceptions", async () => {
		const f = setup();
		f.analytics.track.mockImplementation(() => {
			throw Error("optional");
		});
		const cleanup = mountVercelObservability(f.options);
		f.pending.resolve(f.analytics);
		await tick();
		expect(() => f.event()).not.toThrow();
		cleanup();
		const broken = setup();
		broken.analytics.injectAnalytics.mockImplementation(() => {
			throw Error("optional");
		});
		const stop = mountVercelObservability(broken.options);
		broken.pending.resolve(broken.analytics);
		await tick();
		expect(broken.analytics.track).not.toHaveBeenCalled();
		stop();
	});

	it("redacts query and hash without changing other event fields", () => {
		expect(
			redactObservabilityUrl({
				url: "https://blendcalc.food/profile?secret=yes#private",
				type: "pageview",
			}),
		).toEqual({ url: "https://blendcalc.food/profile", type: "pageview" });
	});
});
