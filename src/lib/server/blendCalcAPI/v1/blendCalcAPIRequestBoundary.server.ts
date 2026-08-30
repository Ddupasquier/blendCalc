export const BLENDCALC_API_V1_REQUEST_TIMEOUT_MILLISECONDS = 10_000;

export class BlendCalcAPIV1RequestTimeoutError extends Error {
	constructor() {
		super("blendCalcAPI request deadline exceeded.");
		this.name = "BlendCalcAPIV1RequestTimeoutError";
	}
}

export const runBlendCalcAPIV1RequestWithinDeadline = async <Result>(
	operation: (databaseAbortSignal: AbortSignal) => Promise<Result>,
	timeoutMilliseconds = BLENDCALC_API_V1_REQUEST_TIMEOUT_MILLISECONDS,
): Promise<Result> => {
	const abortController = new AbortController();
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const timeoutResult = new Promise<never>((_, reject) => {
		timeout = setTimeout(() => {
			abortController.abort();
			reject(new BlendCalcAPIV1RequestTimeoutError());
		}, timeoutMilliseconds);
	});

	try {
		return await Promise.race([
			Promise.resolve().then(() => operation(abortController.signal)),
			timeoutResult,
		]);
	} finally {
		if (timeout) clearTimeout(timeout);
	}
};

export const isBlendCalcAPIV1RequestTimeoutError = (
	error: unknown,
): error is BlendCalcAPIV1RequestTimeoutError =>
	error instanceof BlendCalcAPIV1RequestTimeoutError;
