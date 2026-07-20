import { version as buildVersion } from "$app/environment";

const semanticVersion = buildVersion.split("+")[0] ?? "";
const versionMatch = semanticVersion.match(
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/,
);

if (!versionMatch) {
	throw new Error(`Invalid blendCalc app version: ${buildVersion}`);
}

export const APP_VERSION = semanticVersion;
export const APP_BUILD_VERSION = buildVersion;
export const APP_MAJOR_VERSION = Number(versionMatch[1]);
export const APP_MINOR_VERSION = Number(versionMatch[2]);
export const APP_PATCH_VERSION = Number(versionMatch[3]);
export const APP_VERSION_LABEL = `V${APP_MAJOR_VERSION}`;
