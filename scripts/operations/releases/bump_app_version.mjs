/**
 * Purpose: Bump the blendCalc application release with npm while updating package.json,
 * package-lock.json, and the maintained version table without creating a Git commit or
 * tag. It finishes by running the read-only consistency check.
 * Run: `npm run version:bump -- patch`, `npm run version:bump -- minor`, or
 * `npm run version:bump -- major`
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const bump = process.argv[2];
const allowedBumps = new Set(["patch", "minor", "major"]);

if (!allowedBumps.has(bump)) {
	console.error(
		"Choose exactly one application release bump: patch, minor, or major.",
	);
	process.exit(1);
}

const versioningPath = resolve(repositoryRoot, "docs/versioning.md");
const currentDocumentation = readFileSync(versioningPath, "utf8");
const applicationReleaseRow = /\| Application release \| `[^`]+` \|/;
const applicationBuildRow =
	/\| Application build \| `[^`]+\+<deployment>` \|/;

if (
	!applicationReleaseRow.test(currentDocumentation) ||
	!applicationBuildRow.test(currentDocumentation)
) {
	console.error(
		"docs/versioning.md does not contain the expected application version rows.",
	);
	process.exit(1);
}

const npmResult = spawnSync(
	"npm",
	["version", bump, "--no-git-tag-version"],
	{
		cwd: repositoryRoot,
		encoding: "utf8",
		stdio: "inherit",
	},
);

if (npmResult.status !== 0) process.exit(npmResult.status ?? 1);

const packageMetadata = JSON.parse(
	readFileSync(resolve(repositoryRoot, "package.json"), "utf8"),
);
const nextVersion = packageMetadata.version;
const nextDocumentation = currentDocumentation
	.replace(
		applicationReleaseRow,
		`| Application release | \`${nextVersion}\` |`,
	)
	.replace(
		applicationBuildRow,
		`| Application build | \`${nextVersion}+<deployment>\` |`,
	);

if (nextDocumentation === currentDocumentation) {
	console.error("Could not update the application rows in docs/versioning.md.");
	process.exit(1);
}
writeFileSync(versioningPath, nextDocumentation);

const checkResult = spawnSync(
	process.execPath,
	[resolve(repositoryRoot, "scripts/operations/releases/check_versions.mjs")],
	{
		cwd: repositoryRoot,
		stdio: "inherit",
	},
);
if (checkResult.status !== 0) process.exit(checkResult.status ?? 1);

console.log(
	`Application release is now ${nextVersion}. Review the changed files; no commit or tag was created.`,
);
