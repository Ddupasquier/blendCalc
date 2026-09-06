/**
 * Purpose: Fail a Vercel production build when a root source-function directory
 * can shadow SvelteKit parameterized APIs, or when representative dynamic API
 * routes and their generated functions are absent from the Build Output API.
 * Run: `npm run verify:vercel-routes` after `npm run build`.
 * This command reads tracked source and `.vercel/output`; it performs no writes,
 * network requests, retries, or cleanup.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const outputRoot = ".vercel/output";
const outputConfigurationPath = join(outputRoot, "config.json");

if (existsSync("api")) {
	throw new Error(
		"The root api/ directory can shadow SvelteKit parameterized API routes on Vercel.",
	);
}

if (!existsSync(outputConfigurationPath)) {
	throw new Error(
		"Vercel Build Output is missing. Run this check after the production build.",
	);
}

const outputConfiguration = JSON.parse(
	readFileSync(outputConfigurationPath, "utf8"),
);
const generatedRoutes = Array.isArray(outputConfiguration.routes)
	? outputConfiguration.routes
	: [];
const requiredDestinations = [
	"/api/nutrition-label-ocr/jobs/[jobId]",
	"/api/products/barcode/[barcode]",
	"/api/user-food-lists/[list]",
	"/api/v1/products/[barcode]",
];

for (const destination of requiredDestinations) {
	if (!generatedRoutes.some((route) => route?.dest === destination)) {
		throw new Error(`Vercel Build Output is missing ${destination}.`);
	}

	const functionConfigurationPath = join(
		outputRoot,
		"functions",
		`${destination.slice(1)}.func`,
		".vc-config.json",
	);
	if (!existsSync(functionConfigurationPath)) {
		throw new Error(`Vercel function output is missing for ${destination}.`);
	}
}

const ocrFunctionConfiguration = JSON.parse(
	readFileSync(
		join(
			outputRoot,
			"functions/api/nutrition-label-ocr/jobs.func/.vc-config.json",
		),
		"utf8",
	),
);
if (
	ocrFunctionConfiguration.maxDuration !== 60 ||
	ocrFunctionConfiguration.memory !== 1024
) {
	throw new Error(
		"The hosted OCR background function must retain its 60-second and 1-GiB bounds.",
	);
}

console.log(
	`Vercel dynamic-route contract passed for ${requiredDestinations.length} representative APIs.`,
);
