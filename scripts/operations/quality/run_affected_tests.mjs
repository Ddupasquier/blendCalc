/**
 * Purpose: Select the smallest honest Vitest or Playwright scope from files changed
 * against staging plus current working-tree edits. Browser selection maps application
 * ownership to its routed specs and expands to the bounded compatibility matrix when
 * shared browser infrastructure changes.
 * Run: `npm run test:affected`, `npm run test:e2e:affected`, or
 * `node scripts/operations/quality/run_affected_tests.mjs browser --prepare`.
 */

import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const reportPath = fileURLToPath(
	new URL(
		"../../../test-results/affected-test-selection.json",
		import.meta.url,
	),
);
const mode = process.argv[2] ?? "all";
const shouldPrepareBrowserEnvironment = process.argv.includes("--prepare");

const runCommand = (command, args, { capture = false } = {}) => {
	const result = spawnSync(command, args, {
		cwd: repositoryRoot,
		encoding: "utf8",
		stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
	});
	if (result.status !== 0) {
		if (capture) {
			process.stderr.write(result.stdout ?? "");
			process.stderr.write(result.stderr ?? "");
		}
		process.exit(result.status ?? 1);
	}
	return result.stdout ?? "";
};

const readLines = (command, args) =>
	runCommand(command, args, { capture: true })
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

const getComparisonBase = () => {
	if (process.env.TEST_BASE_REF) return process.env.TEST_BASE_REF;
	const remoteStagingExists = spawnSync(
		"git",
		["rev-parse", "--verify", "origin/staging"],
		{ cwd: repositoryRoot, stdio: "ignore" },
	).status;
	return remoteStagingExists === 0 ? "origin/staging" : "staging";
};

const getChangedFiles = () => {
	const comparisonBase = getComparisonBase();
	const mergeBase = readLines("git", ["merge-base", comparisonBase, "HEAD"])[0];
	const changedFiles = new Set([
		...readLines("git", [
			"diff",
			"--name-only",
			"--diff-filter=ACMR",
			`${mergeBase}...HEAD`,
		]),
		...readLines("git", ["diff", "--name-only", "--diff-filter=ACMR"]),
		...readLines("git", ["ls-files", "--others", "--exclude-standard"]),
	]);
	return [...changedFiles].sort();
};

const browserDomainMappings = [
	{
		owners: ["/mix/", "src/routes/mix", "src/lib/utils/mix"],
		specs: [
			"tests/e2e/mixInteractions.spec.ts",
			"tests/e2e/applicationVisualRegression.spec.ts",
		],
	},
	{
		owners: [
			"/ingredients/",
			"src/routes/ingredients",
			"src/lib/utils/ingredients",
			"src/lib/utils/barcode",
			"src/lib/server/products",
		],
		specs: [
			"tests/e2e/ingredientsInteractions.spec.ts",
			"tests/e2e/ingredientOverlays.spec.ts",
			"tests/e2e/manualEntryInteractions.spec.ts",
			"tests/e2e/barcodeProviderExperience.spec.ts",
		],
	},
	{
		owners: ["/profile/", "src/routes/profile", "src/lib/utils/profile"],
		specs: ["tests/e2e/profileInteractions.spec.ts"],
	},
	{
		owners: ["/saved/", "src/routes/saved"],
		specs: ["tests/e2e/savedRecipeInteractions.spec.ts"],
	},
	{
		owners: ["/auth/", "src/routes/auth", "src/lib/server/auth"],
		specs: [
			"tests/e2e/authenticationInteractions.spec.ts",
			"tests/e2e/authenticatedNavigation.spec.ts",
		],
	},
];
const globalBrowserOwners = [
	"playwright.config.ts",
	"tests/e2e/support/",
	"src/routes/+layout",
	"src/lib/components/common/",
	"src/styles/",
	"vite.config.ts",
];
const globalUnitOwners = [
	"package.json",
	"vite.config.ts",
	"tests/test-setup.ts",
	"tests/test-reference-catalog-setup.ts",
	"scripts/operations/quality/run_affected_tests.mjs",
];

const getBrowserSelection = (changedFiles) => {
	const directlyChangedSpecs = changedFiles.filter(
		(file) => file.startsWith("tests/e2e/") && file.endsWith(".spec.ts"),
	);
	const runBoundedMatrix = changedFiles.some((file) =>
		globalBrowserOwners.some((owner) => file.includes(owner)),
	);
	if (runBoundedMatrix) {
		return {
			projects: [],
			reason: "shared browser ownership changed",
			specs: [],
		};
	}

	const specs = new Set(directlyChangedSpecs);
	for (const mapping of browserDomainMappings) {
		if (
			changedFiles.some((file) =>
				mapping.owners.some((owner) => file.includes(owner)),
			)
		) {
			for (const spec of mapping.specs) specs.add(spec);
		}
	}
	return {
		projects: ["desktop-chromium", "mobile-chromium"],
		reason:
			specs.size > 0 ? "domain owners changed" : "no browser owner changed",
		specs: [...specs].sort(),
	};
};

const runAffectedUnitTests = (changedFiles) => {
	if (changedFiles.length === 0) {
		console.log("No changed files; affected Vitest selection is empty.");
		return;
	}
	if (
		changedFiles.some((file) =>
			globalUnitOwners.some((owner) => file.includes(owner)),
		)
	) {
		console.log(
			"Shared unit-test ownership changed; running every Vitest project.",
		);
		runCommand("npm", ["run", "test"]);
		return;
	}
	runCommand("npx", [
		"vitest",
		"related",
		"--run",
		"--passWithNoTests",
		"--reporter=dot",
		...changedFiles,
	]);
};

const runAffectedBrowserTests = (selection) => {
	if (selection.projects.length > 0 && selection.specs.length === 0) {
		console.log("No browser-owned files changed; Playwright is not required.");
		return;
	}
	if (shouldPrepareBrowserEnvironment) {
		runCommand("npm", ["run", "test:e2e:prepare"]);
	}
	const projectArguments = selection.projects.flatMap((project) => [
		`--project=${project}`,
	]);
	runCommand("npx", [
		"playwright",
		"test",
		...selection.specs,
		...projectArguments,
	]);
};

if (!new Set(["all", "browser", "unit"]).has(mode)) {
	throw new Error(`Unknown affected-test mode ${JSON.stringify(mode)}.`);
}

const changedFiles = getChangedFiles();
const browserSelection = getBrowserSelection(changedFiles);
await mkdir(fileURLToPath(new URL("../../../test-results/", import.meta.url)), {
	recursive: true,
});
await writeFile(
	reportPath,
	`${JSON.stringify({ browserSelection, changedFiles, generatedAt: new Date().toISOString() }, null, 2)}\n`,
);
console.log(
	`Affected-test selection: ${changedFiles.length} changed file${changedFiles.length === 1 ? "" : "s"}; ${browserSelection.reason}.`,
);

if (mode === "all" || mode === "unit") runAffectedUnitTests(changedFiles);
if (mode === "all" || mode === "browser") {
	runAffectedBrowserTests(browserSelection);
}
