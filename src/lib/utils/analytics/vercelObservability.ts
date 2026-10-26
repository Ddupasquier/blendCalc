import { APP_INTERACTION_METRICS } from "./appInteractionMetrics";
import {
	APP_PERFORMANCE_METRIC,
	APP_PERFORMANCE_TIMING_EVENT,
	getPerformanceDurationBucket,
	getPerformanceRouteGroup,
	isApprovedObservabilityHostname,
	SLOW_INTERACTION_THRESHOLD_MS,
	type AppPerformanceTimingDetail,
} from "./performanceObservability";

type Analytics = Pick<
	typeof import("@vercel/analytics/sveltekit"),
	"injectAnalytics" | "track"
>;
type SpeedInsights = Pick<
	typeof import("@vercel/speed-insights/sveltekit"),
	"injectSpeedInsights"
>;
type Options = {
	browser: boolean;
	dev: boolean;
	target?: Window;
	timing?: Performance;
	Observer?: typeof PerformanceObserver;
	loadAnalytics?: () => Promise<Analytics>;
	loadSpeedInsights?: () => Promise<SpeedInsights>;
};

export const redactObservabilityUrl = <Event extends { url: string }>(
	event: Event,
): Event => {
	const url = new URL(event.url);
	url.search = "";
	url.hash = "";
	return { ...event, url: url.toString() };
};

/** Optional reporting must never become an application startup dependency. */
export const mountVercelObservability = ({
	browser,
	dev,
	target = typeof window === "undefined" ? undefined : window,
	timing = typeof performance === "undefined" ? undefined : performance,
	Observer = typeof PerformanceObserver === "undefined"
		? undefined
		: PerformanceObserver,
	loadAnalytics = () => import("@vercel/analytics/sveltekit"),
	loadSpeedInsights = () => import("@vercel/speed-insights/sveltekit"),
}: Options): (() => void) => {
	if (!browser || !target || !timing) return () => {};
	const hydration = timing.now();
	if (dev || !isApprovedObservabilityHostname(target.location.hostname)) {
		target.dispatchEvent(
			new CustomEvent(APP_PERFORMANCE_TIMING_EVENT, {
				detail: { name: "hydration", durationMilliseconds: hydration },
			}),
		);
		return () => {};
	}
	let disposed = false;
	let track: Analytics["track"] | undefined;
	type Metric = { name: string; properties?: Record<string, string> };
	const queued: Metric[] = [];
	const emit = (metric: Metric) => {
		if (disposed) return;
		if (track) {
			try {
				track(metric.name, metric.properties);
			} catch {
				/* Optional transport failures cannot interrupt interactions. */
			}
		} else if (queued.length < 32) queued.push(metric);
	};
	const trackTiming = (detail: AppPerformanceTimingDetail) => {
		if (
			!detail ||
			!["hydration", "slow_interaction", "fridge_load_more"].includes(
				detail.name,
			) ||
			!Number.isFinite(detail.durationMilliseconds)
		)
			return;
		emit({
			name: APP_PERFORMANCE_METRIC,
			properties: {
				phase: detail.name,
				durationBucket: getPerformanceDurationBucket(
					detail.durationMilliseconds,
				),
				routeGroup: getPerformanceRouteGroup(target.location.pathname),
			},
		});
	};
	const handleTiming = (event: Event) =>
		trackTiming((event as CustomEvent<AppPerformanceTimingDetail>).detail);
	target.addEventListener(APP_PERFORMANCE_TIMING_EVENT, handleTiming);
	target.dispatchEvent(
		new CustomEvent(APP_PERFORMANCE_TIMING_EVENT, {
			detail: { name: "hydration", durationMilliseconds: hydration },
		}),
	);
	let reportedSlowInteraction = false;
	const observer = Observer?.supportedEntryTypes.includes("event")
		? new Observer((list) => {
				if (reportedSlowInteraction) return;
				const entry = list
					.getEntries()
					.find((entry) => entry.duration >= SLOW_INTERACTION_THRESHOLD_MS);
				if (!entry) return;
				reportedSlowInteraction = true;
				trackTiming({
					name: "slow_interaction",
					durationMilliseconds: entry.duration,
				});
			})
		: undefined;
	observer?.observe({ type: "event", buffered: true });
	if (
		(
			timing.getEntriesByType("navigation")[0] as
				PerformanceNavigationTiming | undefined
		)?.type === "reload"
	)
		emit({ name: APP_INTERACTION_METRICS.PAGE_RELOAD });
	void Promise.resolve()
		.then(() => (disposed ? undefined : loadAnalytics()))
		.then((analytics) => {
			if (disposed || !analytics) return;
			analytics.injectAnalytics({
				mode: "production",
				debug: false,
				beforeSend: redactObservabilityUrl,
			});
			track = analytics.track;
			for (const metric of queued.splice(0)) emit(metric);
		})
		.catch(() => {
			queued.length = 0;
		});
	void Promise.resolve()
		.then(() => (disposed ? undefined : loadSpeedInsights()))
		.then((insights) => {
			if (!disposed && insights)
				insights.injectSpeedInsights({
					debug: false,
					beforeSend: redactObservabilityUrl,
				});
		})
		.catch(() => {});
	return () => {
		disposed = true;
		track = undefined;
		queued.length = 0;
		observer?.disconnect();
		target.removeEventListener(APP_PERFORMANCE_TIMING_EVENT, handleTiming);
	};
};
