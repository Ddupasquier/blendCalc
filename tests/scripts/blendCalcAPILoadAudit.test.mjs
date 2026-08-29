import { describe, expect, it } from "vitest";
import {
	BLENDCALC_API_LOAD_TARGETS,
	evaluateBlendCalcAPILoadTargets,
	summarizeBlendCalcAPILoadMeasurements,
} from "../../scripts/lib/catalog/blendCalcAPILoadAudit.mjs";

describe("blendCalcAPI read-load audit", () => {
	it("summarizes latency and HTTP failures without hiding unsuccessful reads", () => {
		expect(
			summarizeBlendCalcAPILoadMeasurements([
				{ durationMilliseconds: 10, status: 200 },
				{ durationMilliseconds: 20, status: 304 },
				{ durationMilliseconds: 30, status: 503 },
			]),
		).toEqual({
			requestCount: 3,
			errorCount: 1,
			errorRate: 1 / 3,
			p50Milliseconds: 20,
			p95Milliseconds: 30,
			maximumMilliseconds: 30,
		});
	});

	it("requires every load scenario to meet latency and error budgets", () => {
		const passingSummaries = Object.fromEntries(
			Object.entries(BLENDCALC_API_LOAD_TARGETS).map(([scenario, target]) => [
				scenario,
				{
					requestCount: 5,
					errorCount: 0,
					errorRate: 0,
					p50Milliseconds: 50,
					p95Milliseconds: target.maximumP95Milliseconds,
					maximumMilliseconds: target.maximumP95Milliseconds,
				},
			]),
		);
		expect(
			evaluateBlendCalcAPILoadTargets(passingSummaries).every(
				({ passed }) => passed,
			),
		).toBe(true);
		expect(
			evaluateBlendCalcAPILoadTargets({
				...passingSummaries,
				concurrentMixedReads: {
					...passingSummaries.concurrentMixedReads,
					errorCount: 1,
					errorRate: 0.2,
				},
			}).find(({ scenario }) => scenario === "concurrentMixedReads")?.passed,
		).toBe(false);
	});
});
