/**
 * Purpose: Expose the app version and a consistent blendCalc user-agent builder to
 * scripts that call external services. This is a shared module, not a terminal workflow.
 * Do not run directly; it is imported by audit, seed, backfill, and generator scripts.
 */

import { readFileSync } from "node:fs";

const packageMetadata = JSON.parse(
	readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
);

export const APP_VERSION = packageMetadata.version;
export const APP_ORIGIN = "https://www.blendcalc.food";
export const createAppUserAgent = (purpose) =>
	`blendCalc/${APP_VERSION} (${purpose}; ${APP_ORIGIN})`;
