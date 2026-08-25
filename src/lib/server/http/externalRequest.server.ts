const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

const DEFAULT_TIMEOUT_MILLISECONDS = 8_000;
const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MILLISECONDS = 250;
const MAX_INLINE_RETRY_DELAY_MILLISECONDS = 2_000;

type ExternalRequestPolicy = RequestInit & {
	timeoutMilliseconds?: number;
	maxAttempts?: number;
	acceptedStatusCodes?: number[];
	onAttempt?: () => void;
	onAttemptFailure?: () => void;
	fetcher?: typeof fetch;
	sleep?: (milliseconds: number) => Promise<void>;
};

const wait = (milliseconds: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const getRetryAfterMilliseconds = (response: Response) => {
	const value = response.headers.get("retry-after")?.trim();
	if (!value) return null;

	const seconds = Number(value);
	if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;

	const retryAt = Date.parse(value);
	if (!Number.isFinite(retryAt)) return null;
	return Math.max(0, retryAt - Date.now());
};

const canRetryRequest = (method: string, headers: Headers) =>
	method === "GET" || method === "HEAD" || headers.has("idempotency-key");

export const fetchWithExternalRequestPolicy = async (
	input: string | URL | Request,
	policy: ExternalRequestPolicy = {},
) => {
	const {
		timeoutMilliseconds = DEFAULT_TIMEOUT_MILLISECONDS,
		maxAttempts = DEFAULT_MAX_ATTEMPTS,
		acceptedStatusCodes = [],
		onAttempt,
		onAttemptFailure,
		fetcher = fetch,
		sleep = wait,
		...requestInit
	} = policy;
	const headers = new Headers(requestInit.headers);
	const method = (requestInit.method ?? "GET").toUpperCase();
	const attempts = Math.max(1, Math.min(3, Math.floor(maxAttempts)));
	const retryAllowed = canRetryRequest(method, headers);
	const acceptedStatuses = new Set(acceptedStatusCodes);

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		let retryDelayMilliseconds: number;
		const controller = new AbortController();
		const abortFromCaller = () => controller.abort(requestInit.signal?.reason);
		if (requestInit.signal?.aborted) abortFromCaller();
		else
			requestInit.signal?.addEventListener("abort", abortFromCaller, {
				once: true,
			});
		const timeout = setTimeout(
			() => controller.abort(new Error("External request timed out.")),
			Math.max(1, timeoutMilliseconds),
		);

		onAttempt?.();
		try {
			const response = await fetcher(input, {
				...requestInit,
				headers,
				signal: controller.signal,
			});
			const accepted = response.ok || acceptedStatuses.has(response.status);
			if (accepted) return response;

			onAttemptFailure?.();
			if (
				!retryAllowed ||
				attempt === attempts ||
				!RETRYABLE_STATUS_CODES.has(response.status)
			) {
				return response;
			}

			const retryAfterMilliseconds = getRetryAfterMilliseconds(response);
			if (
				retryAfterMilliseconds !== null &&
				retryAfterMilliseconds > MAX_INLINE_RETRY_DELAY_MILLISECONDS
			) {
				return response;
			}
			retryDelayMilliseconds =
				retryAfterMilliseconds ??
				DEFAULT_RETRY_DELAY_MILLISECONDS * 2 ** (attempt - 1);
		} catch (error) {
			onAttemptFailure?.();
			if (
				!retryAllowed ||
				attempt === attempts ||
				requestInit.signal?.aborted
			) {
				throw error;
			}
			retryDelayMilliseconds =
				DEFAULT_RETRY_DELAY_MILLISECONDS * 2 ** (attempt - 1);
		} finally {
			clearTimeout(timeout);
			requestInit.signal?.removeEventListener("abort", abortFromCaller);
		}

		await sleep(retryDelayMilliseconds);
	}

	throw new Error("External request could not be completed.");
};
