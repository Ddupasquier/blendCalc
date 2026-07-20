import { readFileSync } from "node:fs";

const packageMetadata = JSON.parse(
	readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
);

export const APP_VERSION = packageMetadata.version;
export const APP_ORIGIN = "https://blendcalc.vercel.app";
export const createAppUserAgent = (purpose) =>
	`blendCalc/${APP_VERSION} (${purpose}; ${APP_ORIGIN})`;
