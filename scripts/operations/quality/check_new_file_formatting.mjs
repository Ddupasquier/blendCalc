/**
 * Purpose: Enforce the repository Prettier contract for newly added or modified source
 * and documentation without rewriting established files that have not yet been deliberately
 * normalized. CI compares against FORMAT_BASE_REF; local runs inspect working-tree changes
 * since HEAD plus untracked files.
 * Run: `npm run format:check`
 */

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const supportedFilePattern = /\.(?:c?js|mjs|json|md|scss|svelte|ts|ya?ml)$/u;

const runGit = (argumentsList, { allowFailure = false } = {}) => {
	const result = spawnSync("git", argumentsList, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", allowFailure ? "ignore" : "inherit"],
	});
	if (result.status !== 0 && !allowFailure) process.exit(result.status ?? 1);
	return result;
};

const requestedBaseReference = process.env.FORMAT_BASE_REF?.trim();
const usableBaseReference = requestedBaseReference
	? runGit(["cat-file", "-e", `${requestedBaseReference}^{commit}`], {
			allowFailure: true,
		}).status === 0
		? requestedBaseReference
		: null
	: null;

const changedFileResult = runGit(
	usableBaseReference
		? [
				"diff",
				"--name-only",
				"--diff-filter=AM",
				`${usableBaseReference}...HEAD`,
			]
		: ["diff", "--name-only", "--diff-filter=AM", "HEAD"],
);
const candidateFiles = changedFileResult.stdout.split("\n").filter(Boolean);

if (!usableBaseReference) {
	const untrackedFileResult = runGit([
		"ls-files",
		"--others",
		"--exclude-standard",
	]);
	candidateFiles.push(
		...untrackedFileResult.stdout.split("\n").filter(Boolean),
	);
}

const filesToCheck = [...new Set(candidateFiles)]
	.filter((filePath) => supportedFilePattern.test(filePath))
	.filter((filePath) => existsSync(filePath))
	.sort((left, right) => left.localeCompare(right));

if (filesToCheck.length === 0) {
	console.log("No newly added supported files require a formatting check.");
	process.exit(0);
}

const prettierExecutable = fileURLToPath(
	new URL("../../../node_modules/prettier/bin/prettier.cjs", import.meta.url),
);
const prettierResult = spawnSync(
	process.execPath,
	[prettierExecutable, "--check", "--ignore-unknown", ...filesToCheck],
	{ stdio: "inherit" },
);

process.exit(prettierResult.status ?? 1);
