import { describe, expect, it } from "vitest";
import {
	getPerformanceDurationBucket,
	getPerformanceRouteGroup,
	isApprovedObservabilityHostname,
} from "$lib/utils/analytics/performanceObservability";

describe("performance observability", () => {
	it("allows only approved production hosts", () => {
		for (const hostname of [
			"blendcalc.food",
			"www.blendcalc.food",
			"blendcalc.vercel.app",
		]) {
			expect(isApprovedObservabilityHostname(hostname)).toBe(true);
		}
		expect(isApprovedObservabilityHostname("preview-branch.vercel.app")).toBe(
			false,
		);
		expect(isApprovedObservabilityHostname("localhost")).toBe(false);
	});

	it("buckets timings without exposing exact route or user data", () => {
		expect(getPerformanceDurationBucket(99)).toBe("under_100ms");
		expect(getPerformanceDurationBucket(200)).toBe("200_499ms");
		expect(getPerformanceDurationBucket(3_000)).toBe("2500ms_or_more");
		expect(getPerformanceRouteGroup("/ingredients/fridge/nutrition/42")).toBe(
			"ingredients_fridge",
		);
		expect(getPerformanceRouteGroup("/unrecognized/private/path")).toBe(
			"other",
		);
	});
});
