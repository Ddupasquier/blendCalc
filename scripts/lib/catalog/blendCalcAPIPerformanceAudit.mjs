/**
 * Purpose: Define blendCalcAPI response budgets and pure latency-summary helpers for
 * the authenticated browser performance audit. Do not run directly.
 * Parent workflow: `npm run audit:blendCalcAPI-performance`
 */

export const BLENDCALC_API_RESPONSE_TARGETS = Object.freeze({
	product: Object.freeze({ p95Milliseconds: 1_000 }),
	category: Object.freeze({ p95Milliseconds: 750 }),
	firstPageSearch: Object.freeze({ p95Milliseconds: 1_000 }),
	repeatProduct: Object.freeze({ p95Milliseconds: 150 }),
});

const rounded = (value, digits = 1) => Number(value.toFixed(digits));

/** @param {number[]} values @param {number} quantile */
export const calculateNearestRankPercentile = (values, quantile) => {
	if (values.length === 0) return 0;
	if (!Number.isFinite(quantile) || quantile <= 0 || quantile > 1) {
		throw new Error(
			"Quantile must be greater than zero and no greater than one.",
		);
	}
	const orderedValues = [...values].sort((left, right) => left - right);
	const index = Math.max(0, Math.ceil(orderedValues.length * quantile) - 1);
	return orderedValues[index];
};

/**
 * @param {Array<{durationMilliseconds: number}>} measurements
 */
export const summarizePerformanceMeasurements = (measurements) => {
	const durations = measurements.map((measurement) =>
		Number(measurement.durationMilliseconds),
	);
	return {
		sampleCount: measurements.length,
		p50Milliseconds: rounded(calculateNearestRankPercentile(durations, 0.5)),
		p95Milliseconds: rounded(calculateNearestRankPercentile(durations, 0.95)),
		maximumMilliseconds: rounded(Math.max(0, ...durations)),
	};
};

/**
 * @param {Record<keyof typeof BLENDCALC_API_RESPONSE_TARGETS, ReturnType<typeof summarizePerformanceMeasurements>>} summaries
 */
export const evaluateBlendCalcAPIPerformanceTargets = (summaries) =>
	Object.entries(BLENDCALC_API_RESPONSE_TARGETS).map(
		([scenarioKey, target]) => {
			const summary = summaries[scenarioKey];
			const failures = [];
			if (summary.p95Milliseconds > target.p95Milliseconds) {
				failures.push(
					`p95 ${summary.p95Milliseconds}ms exceeds ${target.p95Milliseconds}ms`,
				);
			}
			return { scenarioKey, passed: failures.length === 0, failures };
		},
	);
