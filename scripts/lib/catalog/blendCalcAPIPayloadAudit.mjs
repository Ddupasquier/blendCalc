/**
 * Purpose: Provide pure byte-size calculations for the authenticated blendCalcAPI
 * payload audit. Do not run directly; import this module from tests or the executable
 * audit.
 */

const rounded = (value, digits = 1) => Number(value.toFixed(digits));

/**
 * @param {{responseBytes: number; compressedBytes: number; itemCount: number}} input
 */
export const summarizeBlendCalcAPIPayload = ({
	responseBytes,
	compressedBytes,
	itemCount,
}) => {
	for (const [name, value] of Object.entries({
		responseBytes,
		compressedBytes,
		itemCount,
	})) {
		if (!Number.isInteger(value) || value < 0) {
			throw new Error(`${name} must be a non-negative whole number.`);
		}
	}

	const normalizedItemCount = Math.max(1, itemCount);
	return {
		responseBytes,
		compressedBytes,
		responseKilobytes: rounded(responseBytes / 1024),
		compressedKilobytes: rounded(compressedBytes / 1024),
		compressionRatio:
			responseBytes === 0 ? 0 : rounded(compressedBytes / responseBytes, 3),
		itemCount,
		bytesPerItem: rounded(responseBytes / normalizedItemCount),
	};
};

/** @param {Record<string, ReturnType<typeof summarizeBlendCalcAPIPayload>>} summaries */
export const findLargestBlendCalcAPIPayload = (summaries) => {
	const entries = Object.entries(summaries);
	if (entries.length === 0) return null;
	const [scenario, summary] = entries.reduce((largest, candidate) =>
		candidate[1].responseBytes > largest[1].responseBytes ? candidate : largest,
	);
	return { scenario, ...summary };
};
