/**
 * Purpose: Define and evaluate the bounded blendCalcAPI pre-beta read-load corpus.
 * This library contains no network or database access.
 * Do not run directly; use the parent workflow below.
 * Parent workflow: `npm run audit:blendCalcAPI-load`
 */

export const BLENDCALC_API_LOAD_TARGETS = Object.freeze({
	commonProduct: { maximumP95Milliseconds: 1_000, maximumErrorRate: 0 },
	broadSearch: { maximumP95Milliseconds: 1_500, maximumErrorRate: 0 },
	emptySearch: { maximumP95Milliseconds: 1_000, maximumErrorRate: 0 },
	warmedProduct: { maximumP95Milliseconds: 500, maximumErrorRate: 0 },
	concurrentMixedReads: { maximumP95Milliseconds: 2_000, maximumErrorRate: 0 },
});

const percentile = (sortedValues, percentileValue) => {
	if (sortedValues.length === 0) return 0;
	const index = Math.min(
		sortedValues.length - 1,
		Math.ceil((percentileValue / 100) * sortedValues.length) - 1,
	);
	return sortedValues[index];
};

export const summarizeBlendCalcAPILoadMeasurements = (measurements) => {
	const durations = measurements
		.map((measurement) => measurement.durationMilliseconds)
		.sort((left, right) => left - right);
	const errorCount = measurements.filter(
		(measurement) => measurement.status < 200 || measurement.status >= 400,
	).length;
	return {
		requestCount: measurements.length,
		errorCount,
		errorRate: measurements.length === 0 ? 1 : errorCount / measurements.length,
		p50Milliseconds: Math.round(percentile(durations, 50) * 10) / 10,
		p95Milliseconds: Math.round(percentile(durations, 95) * 10) / 10,
		maximumMilliseconds: Math.round((durations.at(-1) ?? 0) * 10) / 10,
	};
};

export const evaluateBlendCalcAPILoadTargets = (summaries) =>
	Object.entries(BLENDCALC_API_LOAD_TARGETS).map(([scenario, target]) => {
		const summary = summaries[scenario];
		const failures = [];
		if (!summary) failures.push("scenario was not measured");
		if (summary?.p95Milliseconds > target.maximumP95Milliseconds) {
			failures.push(
				`p95 ${summary.p95Milliseconds}ms exceeded ${target.maximumP95Milliseconds}ms`,
			);
		}
		if (summary?.errorRate > target.maximumErrorRate) {
			failures.push(
				`error rate ${summary.errorRate} exceeded ${target.maximumErrorRate}`,
			);
		}
		return { scenario, passed: failures.length === 0, failures };
	});
