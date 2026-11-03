/**
 * Purpose: Recognize regular public Markdown for the existing verification planners.
 * Uncertain, renamed, deleted, mixed and executable inputs retain source checks.
 * Do not run directly; the local dashboard and verification workflow import this module.
 */

import { execFileSync } from "node:child_process";
import { lstatSync } from "node:fs";
import { join } from "node:path";

const inventoryBufferLimit = 1024 * 1024;
const objectIdPattern = /^[a-f\d]{40}(?:[a-f\d]{24})?$/u;
const rawChangePattern =
	/^:([0-7]{6}) ([0-7]{6}) ([a-f\d]{40}(?:[a-f\d]{24})?) ([a-f\d]{40}(?:[a-f\d]{24})?) ([AM])$/u;
const privateComponents = new Set(["notes", "workspace"]);
const rawDiffArguments = [
	"diff",
	"--raw",
	"-z",
	"--no-abbrev",
	"--find-renames",
	"--no-ext-diff",
	"--no-textconv",
	"--no-relative",
	"--ignore-submodules=none",
	"--no-color",
];

const documentationPath = (path) =>
	!/[\u0000-\u001f\u007f\ufffd\\]/u.test(path) &&
	!path
		.split("/")
		.some(
			(part) =>
				!part ||
				part.startsWith(".") ||
				privateComponents.has(part.toLowerCase()),
		) &&
	(path === "README.md" ||
		path === "scripts/README.md" ||
		path === "docs/README.md" ||
		(/^docs\/(?:development|user)\//u.test(path) && path.endsWith(".md")));

const documentationChanges = (output) => {
	if (typeof output !== "string" || !output.endsWith("\0")) return null;
	const entries = output.slice(0, -1).split("\0");
	if (!entries.length || entries.length % 2 !== 0) return null;
	const paths = [];
	for (let index = 0; index < entries.length; index += 2) {
		const record = rawChangePattern.exec(entries[index]);
		if (!record) return null;
		const [, oldMode, newMode, oldObject, newObject, status] = record;
		if (newMode !== "100644" || oldObject.length !== newObject.length)
			return null;
		if (status === "A" && (oldMode !== "000000" || !/^0+$/u.test(oldObject)))
			return null;
		if (status === "M" && (oldMode !== "100644" || /^0+$/u.test(oldObject)))
			return null;
		const path = entries[index + 1];
		if (!documentationPath(path)) return null;
		paths.push(path);
	}
	return paths;
};

export const classifyVerificationDiff = (output) =>
	documentationChanges(output)?.length ? "documentation" : "source";

const runInventoryGit = (repositoryRoot, args) =>
	execFileSync(
		"git",
		[
			"--no-pager",
			"-c",
			"core.fsmonitor=false",
			"-c",
			"core.untrackedCache=false",
			"-c",
			"core.fileMode=true",
			...args,
		],
		{
			cwd: repositoryRoot,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
			maxBuffer: inventoryBufferLimit,
			env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
		},
	);

export const readVerificationScope = ({
	comparisonBase,
	repositoryRoot = process.cwd(),
}) => {
	if (
		typeof comparisonBase !== "string" ||
		!objectIdPattern.test(comparisonBase)
	)
		return "source";
	try {
		return classifyVerificationDiff(
			runInventoryGit(repositoryRoot, [
				...rawDiffArguments,
				comparisonBase,
				"HEAD",
				"--",
			]),
		);
	} catch {
		return "source";
	}
};

const regularDocumentationFile = (repositoryRoot, path) => {
	if (!documentationPath(path)) return false;
	const stat = lstatSync(join(repositoryRoot, path));
	return stat.isFile() && (stat.mode & 0o111) === 0;
};

export const readLocalVerificationScope = ({
	repositoryRoot = process.cwd(),
	comparisonRef = process.env.TEST_BASE_REF,
} = {}) => {
	const git = (...args) => runInventoryGit(repositoryRoot, args);
	try {
		let base;
		for (const reference of comparisonRef
			? [comparisonRef]
			: ["origin/staging", "staging"]) {
			try {
				base = git("merge-base", "--", reference, "HEAD").trim();
				break;
			} catch {
				/* An unavailable comparison retains the broader checks below. */
			}
		}
		if (!objectIdPattern.test(base ?? "")) return "source";
		const committed = git(...rawDiffArguments, base, "HEAD", "--");
		const working = git(...rawDiffArguments, "HEAD", "--");
		const changed = committed + working;
		const trackedPaths = changed ? documentationChanges(changed) : [];
		if (!trackedPaths) return "source";
		const untracked = git("ls-files", "--others", "--exclude-standard", "-z");
		if (untracked && !untracked.endsWith("\0")) return "source";
		const untrackedPaths = untracked ? untracked.slice(0, -1).split("\0") : [];
		const paths = [...trackedPaths, ...untrackedPaths];
		if (
			!paths.length ||
			!paths.every((path) => regularDocumentationFile(repositoryRoot, path))
		)
			return "source";
		return "documentation";
	} catch {
		return "source";
	}
};
