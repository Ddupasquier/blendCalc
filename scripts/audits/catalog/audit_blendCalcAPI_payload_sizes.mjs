/**
 * Purpose: Measure uncompressed and gzip-estimated response sizes for every
 * authenticated blendCalcAPI v1 read shape without changing catalog data.
 * Start the local production preview with `npm run test:e2e:session:start` first.
 * Run: `npm run audit:blendCalcAPI-payloads`
 * Structured output: `npm run audit:blendCalcAPI-payloads -- --json`
 */

import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";
import { config } from "dotenv";
import {
	findLargestBlendCalcAPIPayload,
	summarizeBlendCalcAPIPayload,
} from "../../lib/catalog/blendCalcAPIPayloadAudit.mjs";

config({ path: ".env.test.local", quiet: true });
config({ path: ".env", quiet: true });

const readArgument = (name, fallback) =>
	process.argv
		.find((argument) => argument.startsWith(`--${name}=`))
		?.split("=")[1] ?? fallback;

const baseUrl = readArgument(
	"base-url",
	process.env.BLENDCALC_API_PAYLOAD_BASE_URL ?? "http://localhost:5174",
).replace(/\/$/, "");
const barcode = readArgument("barcode", "00021130493609");
const searchQuery = readArgument("query", "roasted onion garlic");
const outputJson = process.argv.includes("--json");
const targetUrl = new URL(baseUrl);
const isLocalTarget = new Set(["localhost", "127.0.0.1"]).has(
	targetUrl.hostname,
);
const email =
	process.env.BLENDCALC_API_PAYLOAD_EMAIL ?? "qa-user@blendcalc.local";
const password =
	process.env.BLENDCALC_API_PAYLOAD_PASSWORD ??
	(isLocalTarget ? "BlendCalc-Local-QA-2026!" : "");

if (!/^\d{14}$/.test(barcode)) {
	throw new Error("--barcode must be a normalized 14-digit GTIN.");
}
if (!email || !password) {
	throw new Error(
		"A non-local audit requires BLENDCALC_API_PAYLOAD_EMAIL and BLENDCALC_API_PAYLOAD_PASSWORD.",
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
			`Payload audit authentication failed with HTTP ${authenticationResponse.status()}.`,
		);
	}

	const measurePayload = async (path) => {
		const response = await context.request.get(path, {
			headers: { accept: "application/json" },
		});
		if (!response.ok()) {
			throw new Error(`${path} returned HTTP ${response.status()}.`);
		}
		const body = await response.body();
		const payload = JSON.parse(body.toString("utf8"));
		const data = payload.data;
		return summarizeBlendCalcAPIPayload({
			responseBytes: body.byteLength,
			compressedBytes: gzipSync(body).byteLength,
			itemCount: Array.isArray(data) ? data.length : data == null ? 0 : 1,
		});
	};

	const summaries = {
		product: await measurePayload(`/api/v1/products/${barcode}`),
		firstPageSearch: await measurePayload(
			`/api/v1/foods/search?q=${encodeURIComponent(searchQuery)}&limit=15&offset=0`,
		),
		maximumCategoryPage: await measurePayload(
			"/api/v1/categories?limit=100&offset=0",
		),
		maximumRevisionPage: await measurePayload(
			`/api/v1/products/${barcode}/revisions?limit=100&offset=0`,
		),
	};
	const result = {
		measuredAt: new Date().toISOString(),
		target: baseUrl,
		inputs: { barcode, searchQuery },
		summaries,
		largestPayload: findLargestBlendCalcAPIPayload(summaries),
		detailLevelDecision: {
			added: false,
			reason:
				"No current client contract requires a reduced detail shape; measurements are recorded before adding contract complexity.",
		},
	};

	if (outputJson) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		console.log(`blendCalcAPI payload audit: ${baseUrl}`);
		console.table(
			Object.entries(summaries).map(([scenario, summary]) => ({
				Scenario: scenario,
				Items: summary.itemCount,
				"Response KB": summary.responseKilobytes,
				"Gzip KB": summary.compressedKilobytes,
				"Bytes/item": summary.bytesPerItem,
				"Gzip ratio": summary.compressionRatio,
			})),
		);
		console.log(`Detail levels: ${result.detailLevelDecision.reason}`);
	}
} finally {
	await browser.close();
}
