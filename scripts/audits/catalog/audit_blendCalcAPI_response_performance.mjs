/**
 * Purpose: Measure authenticated blendCalcAPI product, category, first-page search,
 * and warmed repeat reads against explicit p50/p95 budgets. The audit is
 * read-only and never changes production request handling or catalog data.
 * Start the local production preview with `npm run test:e2e:session:start` first.
 * Run: `npm run audit:blendCalcAPI-performance`
 * Structured output: `npm run audit:blendCalcAPI-performance -- --json`
 */

import { chromium } from "@playwright/test";
import { config } from "dotenv";
import {
	BLENDCALC_API_RESPONSE_TARGETS,
	evaluateBlendCalcAPIPerformanceTargets,
	summarizePerformanceMeasurements,
} from "../../lib/catalog/blendCalcAPIPerformanceAudit.mjs";

config({ path: ".env.test.local", quiet: true });
config({ path: ".env", quiet: true });

const readArgument = (name, fallback) =>
	process.argv
		.find((argument) => argument.startsWith(`--${name}=`))
		?.split("=")[1] ?? fallback;

const baseUrl = readArgument(
	"base-url",
	process.env.BLENDCALC_API_PERFORMANCE_BASE_URL ?? "http://localhost:5174",
).replace(/\/$/, "");
const sampleCount = Number.parseInt(readArgument("samples", "20"), 10);
const barcode = readArgument("barcode", "00021130493609");
const searchQuery = readArgument("query", "roasted onion garlic");
const outputJson = process.argv.includes("--json");
const targetUrl = new URL(baseUrl);
const isLocalTarget = new Set(["localhost", "127.0.0.1"]).has(
	targetUrl.hostname,
);
const email =
	process.env.BLENDCALC_API_PERFORMANCE_EMAIL ?? "qa-user@blendcalc.local";
const password =
	process.env.BLENDCALC_API_PERFORMANCE_PASSWORD ??
	(isLocalTarget ? "BlendCalc-Local-QA-2026!" : "");

if (!Number.isInteger(sampleCount) || sampleCount < 20 || sampleCount > 40) {
	throw new Error("--samples must be an integer from 20 through 40.");
}
if (!/^\d{14}$/.test(barcode)) {
	throw new Error("--barcode must be a normalized 14-digit GTIN.");
}
if (!email || !password) {
	throw new Error(
		"A non-local audit requires BLENDCALC_API_PERFORMANCE_EMAIL and BLENDCALC_API_PERFORMANCE_PASSWORD.",
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
			`Performance audit authentication failed with HTTP ${authenticationResponse.status()}.`,
		);
	}

	const page = await context.newPage();
	const bootstrapResponse = await page.goto(
		`${baseUrl}/api/v1/categories?limit=1&offset=0`,
	);
	if (bootstrapResponse?.status() !== 200) {
		throw new Error(
			`Performance audit bootstrap failed with HTTP ${bootstrapResponse?.status() ?? "unknown"}.`,
		);
	}

	const measureRequest = async (path) => {
		const result = await page.evaluate(
			async ({ requestUrl }) => {
				performance.clearResourceTimings();
				const startedAt = performance.now();
				const response = await fetch(requestUrl, {
					cache: "no-store",
					headers: { accept: "application/json" },
				});
				await response.arrayBuffer();
				const durationMilliseconds = performance.now() - startedAt;
				return {
					cacheControl: response.headers.get("cache-control"),
					durationMilliseconds,
					status: response.status,
				};
			},
			{ requestUrl: `${baseUrl}${path}` },
		);
		if (result.status !== 200) {
			throw new Error(`${path} returned HTTP ${result.status}.`);
		}
		return result;
	};

	const measureUncachedScenario = async (path) => {
		const measurements = [];
		for (let sample = 0; sample < sampleCount; sample += 1) {
			measurements.push(await measureRequest(path));
		}
		return measurements;
	};

	const productMeasurements = await measureUncachedScenario(
		`/api/v1/products/${barcode}`,
	);
	const categoryMeasurements = await measureUncachedScenario(
		"/api/v1/categories?limit=50&offset=0",
	);
	const searchMeasurements = await measureUncachedScenario(
		`/api/v1/foods/search?q=${encodeURIComponent(searchQuery)}&limit=15&offset=0`,
	);

	const repeatedProductPath = `/api/v1/products/${barcode}`;
	const primingMeasurement = await measureRequest(repeatedProductPath);
	if (!primingMeasurement.cacheControl?.includes("private")) {
		throw new Error(
			"Repeated product target did not return a private cache policy.",
		);
	}
	const repeatedProductMeasurements = [];
	for (let sample = 0; sample < sampleCount; sample += 1) {
		repeatedProductMeasurements.push(await measureRequest(repeatedProductPath));
	}

	const summaries = {
		product: summarizePerformanceMeasurements(productMeasurements),
		category: summarizePerformanceMeasurements(categoryMeasurements),
		firstPageSearch: summarizePerformanceMeasurements(searchMeasurements),
		repeatProduct: summarizePerformanceMeasurements(
			repeatedProductMeasurements,
		),
	};
	const evaluations = evaluateBlendCalcAPIPerformanceTargets(summaries);
	const result = {
		measuredAt: new Date().toISOString(),
		target: baseUrl,
		sampleCount,
		inputs: { barcode, searchQuery },
		targets: BLENDCALC_API_RESPONSE_TARGETS,
		summaries,
		evaluations,
	};

	if (outputJson) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		console.log(`blendCalcAPI response audit: ${baseUrl}`);
		console.table(
			Object.entries(summaries).map(([scenario, summary]) => ({
				Scenario: scenario,
				Samples: summary.sampleCount,
				"p50 ms": summary.p50Milliseconds,
				"p95 ms": summary.p95Milliseconds,
				"Max ms": summary.maximumMilliseconds,
				Target: BLENDCALC_API_RESPONSE_TARGETS[scenario].p95Milliseconds,
				Passed: evaluations.find(
					(evaluation) => evaluation.scenarioKey === scenario,
				)?.passed,
			})),
		);
	}

	const failures = evaluations.flatMap((evaluation) =>
		evaluation.failures.map(
			(failure) => `${evaluation.scenarioKey}: ${failure}`,
		),
	);
	if (failures.length > 0) {
		throw new Error(`Performance targets failed:\n- ${failures.join("\n- ")}`);
	}
} finally {
	await browser.close();
}
