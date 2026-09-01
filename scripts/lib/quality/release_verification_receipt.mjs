/**
 * Purpose: Record and validate local, content-addressed evidence that an exact clean
 * Git tree completed the full Release Check. This is a shared module, not a terminal
 * workflow. Do not run directly; verification and promotion scripts import it.
 */

import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const RELEASE_RECEIPT_VERSION = 1;
export const DEFAULT_RECEIPT_MAX_AGE_MILLISECONDS = 24 * 60 * 60 * 1000;

const runGit = (repositoryRoot, args) =>
	execFileSync("git", args, {
		cwd: repositoryRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();

export const readReleaseCandidateState = (repositoryRoot) => ({
	commit: runGit(repositoryRoot, ["rev-parse", "HEAD"]),
	tree: runGit(repositoryRoot, ["rev-parse", "HEAD^{tree}"]),
	status: runGit(repositoryRoot, [
		"status",
		"--porcelain",
		"--untracked-files=all",
	]),
});

export const getReleaseReceiptDirectory = (repositoryRoot) => {
	const commonGitDirectory = runGit(repositoryRoot, [
		"rev-parse",
		"--path-format=absolute",
		"--git-common-dir",
	]);
	return join(
		resolve(repositoryRoot, commonGitDirectory),
		"blendcalc-verification",
	);
};

export const getReleaseReceiptPath = (repositoryRoot, tree) =>
	join(getReleaseReceiptDirectory(repositoryRoot), `release-${tree}.json`);

export const makeReleaseReceipt = ({ candidate, now = new Date() }) => ({
	version: RELEASE_RECEIPT_VERSION,
	profile: "release",
	status: "passed",
	commit: candidate.commit,
	tree: candidate.tree,
	verifiedAt: now.toISOString(),
	nodeVersion: process.version,
	platform: process.platform,
	architecture: process.arch,
});

export const validateReleaseReceipt = ({
	receipt,
	candidate,
	now = new Date(),
	maximumAgeMilliseconds = DEFAULT_RECEIPT_MAX_AGE_MILLISECONDS,
}) => {
	if (receipt.version !== RELEASE_RECEIPT_VERSION) {
		throw new Error("The release receipt version is no longer supported.");
	}
	if (receipt.profile !== "release" || receipt.status !== "passed") {
		throw new Error("The receipt does not record a successful Release Check.");
	}
	if (receipt.tree !== candidate.tree) {
		throw new Error(
			`The current tree ${candidate.tree} does not match verified tree ${receipt.tree}.`,
		);
	}
	if (candidate.status) {
		throw new Error("Promotion reuse requires a clean working tree.");
	}
	if (
		receipt.nodeVersion !== process.version ||
		receipt.platform !== process.platform ||
		receipt.architecture !== process.arch
	) {
		throw new Error(
			"The release receipt was created in a different runtime environment.",
		);
	}
	const verifiedAt = Date.parse(receipt.verifiedAt);
	if (!Number.isFinite(verifiedAt)) {
		throw new Error("The release receipt has an invalid verification time.");
	}
	if (now.getTime() - verifiedAt > maximumAgeMilliseconds) {
		throw new Error("The release receipt is stale; run a fresh Release Check.");
	}
	return receipt;
};

export const invalidateReleaseReceipt = async (repositoryRoot) => {
	const candidate = readReleaseCandidateState(repositoryRoot);
	await rm(getReleaseReceiptPath(repositoryRoot, candidate.tree), {
		force: true,
	});
};

export const recordReleaseReceipt = async (
	repositoryRoot,
	now = new Date(),
) => {
	const candidate = readReleaseCandidateState(repositoryRoot);
	if (candidate.status) {
		return {
			recorded: false,
			reason:
				"The working tree is not clean, so this result cannot be reused for promotion.",
		};
	}
	const receipt = makeReleaseReceipt({ candidate, now });
	const directory = getReleaseReceiptDirectory(repositoryRoot);
	await mkdir(directory, { recursive: true, mode: 0o700 });
	const path = getReleaseReceiptPath(repositoryRoot, candidate.tree);
	await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`, {
		mode: 0o600,
	});
	return { recorded: true, path, receipt };
};

export const verifyReleaseReceipt = async (repositoryRoot, options = {}) => {
	const candidate = readReleaseCandidateState(repositoryRoot);
	const path = getReleaseReceiptPath(repositoryRoot, candidate.tree);
	let receipt;
	try {
		receipt = JSON.parse(await readFile(path, "utf8"));
	} catch {
		throw new Error(
			`No reusable Release Check exists for tree ${candidate.tree}. Run npm run verify:release.`,
		);
	}
	return {
		path,
		receipt: validateReleaseReceipt({ receipt, candidate, ...options }),
	};
};

export const verifyMatchingGitTrees = (repositoryRoot, expectedReference) => {
	const candidate = readReleaseCandidateState(repositoryRoot);
	if (candidate.status) {
		throw new Error("Promotion integrity requires a clean working tree.");
	}
	const currentTree = candidate.tree;
	const expectedTree = runGit(repositoryRoot, [
		"rev-parse",
		`${expectedReference}^{tree}`,
	]);
	if (currentTree !== expectedTree) {
		throw new Error(
			`Promotion tree ${currentTree} does not match ${expectedReference} tree ${expectedTree}.`,
		);
	}
	return { currentTree, expectedTree };
};
