/**
 * Purpose: Run a bounded, authenticated, read-only blendCalcAPI load audit for
 * common, broad, empty, warmed-cache, and mixed concurrent request paths.
 * Start the local production preview with `npm run test:e2e:session:start` first.
 * Run: `npm run audit:blendCalcAPI-load`
 * Structured output: `npm run audit:blendCalcAPI-load -- --json`
 */

import { chromium } from "@playwright/test";
import { config } from "dotenv";
import {
	BLENDCALC_API_LOAD_TARGETS,
	evaluateBlendCalcAPILoadTargets,
	summarizeBlendCalcAPILoadMeasurements,
} from "../../lib/catalog/blendCalcAPILoadAudit.mjs";

config({ path: ".env.test.local", quiet: true });
config({ path: ".env", quiet: true });

const readArgument = (name, fallback) =>
	process.argv
		.find((argument) => argument.startsWith(`--${name}=`))
		?.split("=")[1] ?? fallback;

const baseUrl = readArgument(
	"base-url",
	process.env.BLENDCALC_API_LOAD_BASE_URL ?? "http://localhost:5174",
).replace(/\/$/, "");
const barcode = readArgument("barcode", "00021130493609");
const commonQuery = readArgument("query", "roasted onion garlic");
const concurrency = Number.parseInt(readArgument("concurrency", "5"), 10);
const iterations = Number.parseInt(readArgument("iterations", "5"), 10);
const outputJson = process.argv.includes("--json");
const isLocal = new Set(["localhost", "127.0.0.1"]).has(
	new URL(baseUrl).hostname,
);
const email = process.env.BLENDCALC_API_LOAD_EMAIL ?? "qa-user@blendcalc.local";
const password =
	process.env.BLENDCALC_API_LOAD_PASSWORD ??
	(isLocal ? "BlendCalc-Local-QA-2026!" : "");

if (!/^\d{14}$/.test(barcode))
	throw new Error("--barcode must be a 14-digit GTIN.");
if (!Number.isInteger(concurrency) || concurrency < 2 || concurrency > 10) {
	throw new Error("--concurrency must be an integer from 2 through 10.");
}
if (!Number.isInteger(iterations) || iterations < 3 || iterations > 20) {
	throw new Error("--iterations must be an integer from 3 through 20.");
}
if (!email || !password) {
	throw new Error(
		"Non-local load audits require load-audit email and password variables.",
	);
}

const browser = await chromium.launch({ headless: true });
try {
	const context = await browser.newContext({ baseURL: baseUrl });
	const authenticationResponse = await context.request.post(
		"/auth?/emailSignIn",
		{
			headers: { origin: baseUrl },
			form: { email, password, next: "/ingredients/fridge" },
		},
	);
	const authenticationResult = await authenticationResponse.json();
	if (
		!authenticationResponse.ok() ||
		authenticationResult.type !== "redirect" ||
		authenticationResult.location !== "/ingredients/fridge"
	) {
		throw new Error(
			`Load audit authentication failed with HTTP ${authenticationResponse.status()}.`,
		);
	}

	const measure = async (path) => {
		const startedAt = performance.now();
		const response = await context.request.get(path, {
			headers: { accept: "application/json" },
		});
		await response.body();
		return {
			durationMilliseconds: performance.now() - startedAt,
			status: response.status(),
		};
	};
	const repeat = async (path, count = iterations) =>
		Promise.all(Array.from({ length: count }, () => measure(path)));

	const productPath = `/api/v1/products/${barcode}`;
	const broadSearchPath = `/api/v1/foods/search?q=${encodeURIComponent(commonQuery)}&limit=50&offset=0`;
	const emptySearchPath = `/api/v1/foods/search?q=${encodeURIComponent(`no-result-${barcode}`)}&limit=50&offset=0`;
	await measure(productPath);

	const scenarioMeasurements = {
		commonProduct: await repeat(`${productPath}?load=common`),
		broadSearch: await repeat(`${broadSearchPath}&load=broad`),
		emptySearch: await repeat(`${emptySearchPath}&load=empty`),
		warmedProduct: await repeat(productPath),
		concurrentMixedReads: [],
	};
	const mixedPaths = [
		productPath,
		broadSearchPath,
		emptySearchPath,
		"/api/v1/categories?limit=100&offset=0",
	];
	for (let iteration = 0; iteration < iterations; iteration += 1) {
		const batch = await Promise.all(
			Array.from({ length: concurrency }, (_, index) =>
				measure(mixedPaths[index % mixedPaths.length]),
			),
		);
		scenarioMeasurements.concurrentMixedReads.push(...batch);
	}

	const summaries = Object.fromEntries(
		Object.entries(scenarioMeasurements).map(([scenario, measurements]) => [
			scenario,
			summarizeBlendCalcAPILoadMeasurements(measurements),
		]),
	);
	const evaluations = evaluateBlendCalcAPILoadTargets(summaries);
	const result = {
		measuredAt: new Date().toISOString(),
		target: baseUrl,
		inputs: { barcode, commonQuery, concurrency, iterations },
		targets: BLENDCALC_API_LOAD_TARGETS,
		summaries,
		evaluations,
	};
	if (outputJson) console.log(JSON.stringify(result, null, 2));
	else {
		console.log(`blendCalcAPI read-load audit: ${baseUrl}`);
		console.table(
			Object.entries(summaries).map(([scenario, summary]) => ({
				Scenario: scenario,
				Requests: summary.requestCount,
				Errors: summary.errorCount,
				"p50 ms": summary.p50Milliseconds,
				"p95 ms": summary.p95Milliseconds,
				Passed: evaluations.find(
					(evaluation) => evaluation.scenario === scenario,
				)?.passed,
			})),
		);
	}
	const failures = evaluations.flatMap((evaluation) =>
		evaluation.failures.map((failure) => `${evaluation.scenario}: ${failure}`),
	);
	if (failures.length > 0)
		throw new Error(`Load targets failed:\n- ${failures.join("\n- ")}`);
} finally {
	await browser.close();
}
