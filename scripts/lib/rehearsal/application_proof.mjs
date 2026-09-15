/**
 * Purpose: Validate BlendCalc-specific Rehearsal browser CSP, restored Storage assets,
 * and bounded stale-session recovery behavior. Do not run directly.
 */

const SELF_SOURCE = "'self'";
const OPEN_FOOD_FACTS_IMAGE_SOURCE = "https://images.openfoodfacts.org";

const toWebSocketOrigin = (httpOrigin) => {
	const url = new URL(httpOrigin);
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
	return url.origin;
};

const assertExactDirectiveSources = (directives, name, expectedSources) => {
	const actualSources = directives.get(name);
	if (!actualSources) {
		throw new Error(`Rehearsal CSP is missing the ${name} directive.`);
	}

	const actual = [...actualSources].sort();
	const expected = [...expectedSources].sort();
	if (
		actual.length !== expected.length ||
		actual.some((source, index) => source !== expected[index])
	) {
		throw new Error(
			`Rehearsal CSP ${name} sources are not exact. Expected ${expected.join(" ")}; received ${actual.join(" ")}.`,
		);
	}
};

export const parseContentSecurityPolicy = (header) => {
	if (typeof header !== "string" || !header.trim()) {
		throw new Error("Rehearsal response omitted its Content Security Policy.");
	}

	const directives = new Map();
	for (const segment of header.split(";")) {
		const tokens = segment.trim().split(/\s+/u).filter(Boolean);
		if (tokens.length === 0) continue;
		const [name, ...sources] = tokens;
		if (directives.has(name)) {
			throw new Error(`Rehearsal CSP repeats the ${name} directive.`);
		}
		directives.set(name, sources);
	}
	return directives;
};

export const assertRehearsalContentSecurityPolicy = (
	header,
	{ applicationSupabaseUrl, blendCalcAPIUrl },
) => {
	const applicationSupabaseOrigin = new URL(applicationSupabaseUrl).origin;
	const blendCalcAPIOrigin = new URL(blendCalcAPIUrl).origin;
	const directives = parseContentSecurityPolicy(header);

	assertExactDirectiveSources(directives, "default-src", [SELF_SOURCE]);
	assertExactDirectiveSources(directives, "frame-src", [SELF_SOURCE]);
	assertExactDirectiveSources(directives, "worker-src", [SELF_SOURCE, "blob:"]);
	assertExactDirectiveSources(directives, "img-src", [
		SELF_SOURCE,
		"data:",
		"blob:",
		applicationSupabaseOrigin,
		OPEN_FOOD_FACTS_IMAGE_SOURCE,
	]);
	assertExactDirectiveSources(directives, "connect-src", [
		SELF_SOURCE,
		applicationSupabaseOrigin,
		toWebSocketOrigin(applicationSupabaseOrigin),
		blendCalcAPIOrigin,
		toWebSocketOrigin(blendCalcAPIOrigin),
		OPEN_FOOD_FACTS_IMAGE_SOURCE,
	]);

	for (const [name, sources] of directives) {
		for (const forbidden of [
			"http:",
			"https:",
			"*",
			"http://127.0.0.1:54321",
			"ws://127.0.0.1:54321",
			"https://*.supabase.co",
			"wss://*.supabase.co",
			"https://challenges.cloudflare.com",
			"https://cdn.jsdelivr.net",
		]) {
			if (sources.includes(forbidden)) {
				throw new Error(
					`Rehearsal CSP ${name} permits forbidden source ${forbidden}.`,
				);
			}
		}
	}

	return directives;
};

export const assertLoadedRehearsalStorageImage = (
	images,
	{ applicationSupabaseUrl, bucket },
) => {
	const expectedOrigin = new URL(applicationSupabaseUrl).origin;
	const expectedPathPrefix = `/storage/v1/object/sign/${bucket}/`;
	const image = images.find(
		(candidate) =>
			candidate.origin === expectedOrigin &&
			candidate.pathname.startsWith(expectedPathPrefix),
	);
	if (!image) {
		throw new Error(
			`Rehearsal browser proof did not render a signed ${bucket} Storage image.`,
		);
	}
	if (
		image.complete !== true ||
		!Number.isFinite(image.naturalWidth) ||
		image.naturalWidth <= 0 ||
		!Number.isFinite(image.naturalHeight) ||
		image.naturalHeight <= 0
	) {
		throw new Error(
			`Rehearsal ${bucket} Storage image did not load at nonzero dimensions.`,
		);
	}
	return image;
};
