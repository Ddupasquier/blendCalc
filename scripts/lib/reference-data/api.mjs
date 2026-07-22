const wait = (milliseconds) =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

export const fetchWithRetry = async (
	url,
	options = {},
	{ attempts = 4, baseDelayMilliseconds = 750 } = {},
) => {
	let lastError;
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			const response = await fetch(url, options);
			if (response.ok) return response;
			if (![429, 500, 502, 503, 504].includes(response.status)) {
				throw new Error(`${url} returned ${response.status}.`);
			}
			lastError = new Error(`${url} temporarily returned ${response.status}.`);
			const retryAfterSeconds = Number(response.headers.get("retry-after"));
			const delay = Number.isFinite(retryAfterSeconds)
				? retryAfterSeconds * 1000
				: baseDelayMilliseconds * (2 ** (attempt - 1));
			await wait(delay);
		} catch (error) {
			lastError = error;
			if (attempt < attempts) {
				await wait(baseDelayMilliseconds * (2 ** (attempt - 1)));
			}
		}
	}
	throw lastError ?? new Error(`Unable to fetch ${url}.`);
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
