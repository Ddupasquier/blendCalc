import { describe, expect, it } from "vitest";
import {
	BLENDCALC_API_RESPONSE_TARGETS,
	calculateNearestRankPercentile,
	evaluateBlendCalcAPIPerformanceTargets,
	summarizePerformanceMeasurements,
} from "../../scripts/lib/catalog/blendCalcAPIPerformanceAudit.mjs";

describe("blendCalcAPI performance audit", () => {
	it("uses nearest-rank percentiles without averaging away slow samples", () => {
		expect(calculateNearestRankPercentile([10, 20, 30, 40, 500], 0.5)).toBe(30);
		expect(calculateNearestRankPercentile([10, 20, 30, 40, 500], 0.95)).toBe(
			500,
		);
	});

	it("summarizes latency without averaging away the slowest sample", () => {
		expect(
			summarizePerformanceMeasurements([
				{ durationMilliseconds: 10 },
				{ durationMilliseconds: 20 },
				{ durationMilliseconds: 30 },
			]),
		).toEqual({
			sampleCount: 3,
			p50Milliseconds: 20,
			p95Milliseconds: 30,
			maximumMilliseconds: 30,
		});
	});

	it("fails a repeat-read latency regression independently", () => {
		const passingSummary = {
			sampleCount: 15,
			p50Milliseconds: 25,
			p95Milliseconds: 50,
			maximumMilliseconds: 60,
		};
		const evaluations = evaluateBlendCalcAPIPerformanceTargets({
			product: passingSummary,
			category: passingSummary,
			firstPageSearch: passingSummary,
			repeatProduct: {
				...passingSummary,
				p95Milliseconds:
					BLENDCALC_API_RESPONSE_TARGETS.repeatProduct.p95Milliseconds + 1,
			},
		});

		expect(evaluations.slice(0, 3).every((result) => result.passed)).toBe(true);
		expect(evaluations[3]).toMatchObject({
			scenarioKey: "repeatProduct",
			passed: false,
		});
		expect(evaluations[3].failures).toHaveLength(1);
	});
});
