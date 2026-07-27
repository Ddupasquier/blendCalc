/**
 * Purpose: Verify that application, build, API route, response-contract, OpenAPI, test,
 * and version-documentation metadata stay consistent without modifying repository files.
 * Run: `npm run version:check`
 * This read-only check also runs automatically before `npm run check` and
 * `npm run build`.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const failures = [];
const semanticVersionPattern =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const apiContractVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const readText = (relativePath) =>
	readFileSync(resolve(repositoryRoot, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(readText(relativePath));
const requireCondition = (condition, message) => {
	if (!condition) failures.push(message);
};

const packageMetadata = readJson("package.json");
const packageLock = readJson("package-lock.json");
const appVersion = packageMetadata.version;
const lockRootVersion = packageLock.packages?.[""]?.version;
const svelteConfig = readText("svelte.config.js");
const runtimeVersionSource = readText("src/lib/config/version.ts");
const apiTypesSource = readText("src/lib/api/v1/types.ts");
const apiHttpSource = readText("src/lib/server/api/v1/http.server.ts");
const appVersionTest = readText("tests/config/appVersioning.test.ts");
const apiRouteTest = readText("tests/routes/catalogApiV1Routes.test.ts");
const versioningDocumentation = readText("docs/versioning.md");
const openApi = readJson("static/api/v1/openapi.json");

requireCondition(
	typeof appVersion === "string" && semanticVersionPattern.test(appVersion),
	`package.json version must be semantic versioning; received ${JSON.stringify(appVersion)}.`,
);
requireCondition(
	lockRootVersion === appVersion,
	`package-lock.json root version ${JSON.stringify(lockRootVersion)} must match package.json ${JSON.stringify(appVersion)}.`,
);
requireCondition(
	svelteConfig.includes("packageMetadata.version") &&
		svelteConfig.includes("kit:") &&
		svelteConfig.includes("version:"),
	"SvelteKit build version must derive from package.json through kit.version.",
);
requireCondition(
	runtimeVersionSource.includes('from "$app/environment"') &&
		runtimeVersionSource.includes("export const APP_VERSION") &&
		runtimeVersionSource.includes("export const APP_BUILD_VERSION"),
	"Runtime app release/build constants must derive from SvelteKit's generated version.",
);

const apiVersionMatch = apiTypesSource.match(
	/export const BLENDCALC_API_V1 = "([^"]+)" as const;/,
);
const apiVersion = apiVersionMatch?.[1] ?? "";
requireCondition(
	apiContractVersionPattern.test(apiVersion),
	`BLENDCALC_API_V1 must use major.minor format; received ${JSON.stringify(apiVersion)}.`,
);

const [apiMajor = "", apiMinor = ""] = apiVersion.split(".");
const openApiVersion = openApi.info?.version ?? "";
const openApiVersionMatch = String(openApiVersion).match(semanticVersionPattern);
requireCondition(
	Boolean(openApiVersionMatch),
	`OpenAPI info.version must be semantic versioning; received ${JSON.stringify(openApiVersion)}.`,
);
requireCondition(
	openApiVersionMatch?.[1] === apiMajor &&
		openApiVersionMatch?.[2] === apiMinor,
	`OpenAPI ${openApiVersion} must share major.minor with API response ${apiVersion}.`,
);
requireCondition(
	openApi.info?.["x-blendcalc-status"] === "internal",
	'OpenAPI preview status must be stored separately as info["x-blendcalc-status"] = "internal".',
);

const expectedApiPathPrefix = `/api/v${apiMajor}/`;
const openApiPaths = Object.keys(openApi.paths ?? {});
requireCondition(
	existsSync(resolve(repositoryRoot, `src/routes/api/v${apiMajor}`)),
	`API route directory src/routes/api/v${apiMajor} must match response version ${apiVersion}.`,
);
requireCondition(
	openApiPaths.length > 0 &&
		openApiPaths.every((path) => path.startsWith(expectedApiPathPrefix)),
	`Every OpenAPI path must use the API major prefix ${expectedApiPathPrefix}.`,
);
requireCondition(
	apiHttpSource.includes('"x-blendcalc-api-version": BLENDCALC_API_V1') &&
		apiHttpSource.includes("apiVersion: BLENDCALC_API_V1"),
	"API responses and headers must use BLENDCALC_API_V1 rather than a literal version.",
);

const responseVersionConstants = [];
const collectResponseVersionConstants = (value) => {
	if (Array.isArray(value)) {
		for (const item of value) collectResponseVersionConstants(item);
		return;
	}
	if (!value || typeof value !== "object") return;
	for (const [key, child] of Object.entries(value)) {
		if (
			key === "apiVersion" &&
			child &&
			typeof child === "object" &&
			"const" in child
		) {
			responseVersionConstants.push(child.const);
		}
		collectResponseVersionConstants(child);
	}
};
collectResponseVersionConstants(openApi);
requireCondition(
	responseVersionConstants.length > 0 &&
		responseVersionConstants.every((value) => value === apiVersion),
	`Every OpenAPI apiVersion const must equal ${apiVersion}.`,
);

requireCondition(
	appVersionTest.includes("APP_VERSION") &&
		appVersionTest.includes("BLENDCALC_API_V1") &&
		!appVersionTest.includes(`toBe("${appVersion}")`),
	"Version tests must validate source consistency without pinning the complete app release.",
);
requireCondition(
	apiRouteTest.includes("BLENDCALC_API_V1") &&
		!apiRouteTest.match(/apiVersion:\s*"\d+\.\d+"/) &&
		!apiRouteTest.match(/x-blendcalc-api-version"\)\)\.toBe\("\d+\.\d+"/),
	"API route tests must use BLENDCALC_API_V1 instead of repeating a literal contract version.",
);
requireCondition(
	versioningDocumentation.includes(
		`| Application release | \`${appVersion}\` |`,
	),
	`docs/versioning.md must list application release ${appVersion}.`,
);
requireCondition(
	versioningDocumentation.includes(
		`| Application build | \`${appVersion}+<deployment>\` |`,
	),
	`docs/versioning.md must list build prefix ${appVersion}+<deployment>.`,
);
requireCondition(
	versioningDocumentation.includes(
		`URL \`/api/v${apiMajor}\`, response \`${apiVersion}\`, OpenAPI \`${openApiVersion}\``,
	),
	"docs/versioning.md must list the current API path, response, and OpenAPI versions.",
);

if (failures.length > 0) {
	console.error("Version consistency check failed:");
	for (const failure of failures) console.error(`- ${failure}`);
	process.exit(1);
}

console.log(
	`Version consistency passed: app ${appVersion}, build ${appVersion}+<deployment>, API v${apiMajor} response ${apiVersion}, OpenAPI ${openApiVersion} (${openApi.info["x-blendcalc-status"]}).`,
);
