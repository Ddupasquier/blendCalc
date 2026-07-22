const wait = (milliseconds) =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

const getRetryDelayMilliseconds = (response, fallbackMilliseconds) => {
	const retryAfter = response.headers.get("retry-after");
	const retryAfterSeconds = Number(retryAfter);
	if (Number.isFinite(retryAfterSeconds)) return retryAfterSeconds * 1000;

	const retryAt = Date.parse(retryAfter ?? "");
	if (Number.isFinite(retryAt)) return Math.max(0, retryAt - Date.now());

	return fallbackMilliseconds;
};

export const fetchWithRetry = async (
	url,
	options = {},
	{ attempts = 4, baseDelayMilliseconds = 750 } = {},
) => {
	let lastError;
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		let response;
		try {
			response = await fetch(url, options);
		} catch (error) {
			lastError = error;
			if (attempt < attempts) {
				await wait(baseDelayMilliseconds * (2 ** (attempt - 1)));
			}
			continue;
		}

		if (response.ok) return response;
		if (!RETRYABLE_STATUS_CODES.has(response.status)) {
			throw new Error(`${url} returned ${response.status}.`);
		}

		lastError = new Error(`${url} temporarily returned ${response.status}.`);
		if (attempt < attempts) {
			await wait(
				getRetryDelayMilliseconds(
					response,
					baseDelayMilliseconds * (2 ** (attempt - 1)),
				),
			);
		}
	}
	throw lastError ?? new Error(`Unable to fetch ${url}.`);
};

export const runSettledWithConcurrency = async (items, concurrency, task) => {
	const results = new Array(items.length);
	const failures = [];
	let nextIndex = 0;

	const worker = async () => {
		while (nextIndex < items.length) {
			const currentIndex = nextIndex;
			nextIndex += 1;
			try {
				results[currentIndex] = await task(items[currentIndex], currentIndex);
			} catch (error) {
				failures.push({
					index: currentIndex,
					item: items[currentIndex],
					error,
				});
			}
		}
	};

	await Promise.all(
		Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, worker),
	);

	return {
		failures: failures.sort((left, right) => left.index - right.index),
		values: results.filter((result) => result !== undefined),
	};
};

export const readHtmlTitle = async (url, fallback) => {
	if (!url) return fallback;
	try {
		const response = await fetchWithRetry(url, {}, { attempts: 2 });
		const html = await response.text();
		const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
			?.replace(/\s+/g, " ")
			.trim();
		return title || fallback;
	} catch {
		return fallback;
	}
};

export const convertUcumUnit = async ({ quantity = 1, fromCode, toCode }) => {
	const url = new URL(
		`https://ucum.nlm.nih.gov/ucum-service/v1/ucumtransform/${quantity}/from/${encodeURIComponent(fromCode)}/to/${encodeURIComponent(toCode)}`,
	);
	const response = await fetchWithRetry(url);
	const xml = await response.text();
	const value = Number(xml.match(/<ResultQuantity>([^<]+)<\/ResultQuantity>/i)?.[1]);
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error(`UCUM could not convert ${fromCode} to ${toCode}.`);
	}
	return { value, sourceReference: url.toString(), response: xml };
};
