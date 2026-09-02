export const APP_PERFORMANCE_TIMING_EVENT = "blendcalc:performance-timing";

export const APP_PERFORMANCE_METRIC = "app_performance_timing";

export type AppPerformanceTimingName =
	"hydration" | "slow_interaction" | "fridge_load_more";

export type AppPerformanceTimingDetail = {
	name: AppPerformanceTimingName;
	durationMilliseconds: number;
};

const approvedProductionHostnames = new Set([
	"blendcalc.food",
	"www.blendcalc.food",
	"blendcalc.vercel.app",
]);

export const isApprovedObservabilityHostname = (hostname: string) =>
	approvedProductionHostnames.has(hostname.toLowerCase());

export const getPerformanceDurationBucket = (durationMilliseconds: number) => {
	const duration = Math.max(0, durationMilliseconds);
	if (duration < 100) return "under_100ms";
	if (duration < 200) return "100_199ms";
	if (duration < 500) return "200_499ms";
	if (duration < 1_000) return "500_999ms";
	if (duration < 2_500) return "1000_2499ms";
	return "2500ms_or_more";
};

export const getPerformanceRouteGroup = (pathname: string) => {
	if (pathname.startsWith("/ingredients/fridge")) return "ingredients_fridge";
	if (pathname.startsWith("/ingredients/shopping")) {
		return "ingredients_shopping";
	}
	if (pathname.startsWith("/ingredients")) return "ingredients_other";
	if (pathname.startsWith("/mix")) return "mix";
	if (pathname.startsWith("/saved")) return "saved";
	if (pathname.startsWith("/profile")) return "profile";
	return "other";
};

export const reportAppPerformanceTiming = (
	name: AppPerformanceTimingName,
	durationMilliseconds: number,
) => {
	if (typeof window === "undefined" || !Number.isFinite(durationMilliseconds)) {
		return;
	}
	window.dispatchEvent(
		new CustomEvent<AppPerformanceTimingDetail>(APP_PERFORMANCE_TIMING_EVENT, {
			detail: {
				name,
				durationMilliseconds: Math.max(0, durationMilliseconds),
			},
		}),
	);
};
