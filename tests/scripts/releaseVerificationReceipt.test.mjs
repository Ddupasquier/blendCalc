import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	DEFAULT_RECEIPT_MAX_AGE_MILLISECONDS,
	invalidateReleaseReceipt,
	makeReleaseReceipt,
	readReleaseCandidateState,
	recordReleaseReceipt,
	validateReleaseReceipt,
	verifyMatchingGitTrees,
	verifyReleaseReceipt,
} from "../../scripts/lib/quality/release_verification_receipt.mjs";

const temporaryRepositories = [];

const runGit = (repositoryRoot, args) =>
	execFileSync("git", args, {
		cwd: repositoryRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();

const createRepository = async () => {
	const repositoryRoot = await mkdtemp(join(tmpdir(), "blendcalc-release-"));
	temporaryRepositories.push(repositoryRoot);
	runGit(repositoryRoot, ["init", "--quiet"]);
	runGit(repositoryRoot, [
		"config",
		"user.email",
		"release-test@blendcalc.local",
	]);
	runGit(repositoryRoot, ["config", "user.name", "Release Test"]);
	await writeFile(join(repositoryRoot, "candidate.txt"), "candidate\n");
	runGit(repositoryRoot, ["add", "candidate.txt"]);
	runGit(repositoryRoot, ["commit", "--quiet", "-m", "candidate"]);
	return repositoryRoot;
};

afterEach(async () => {
	await Promise.all(
		temporaryRepositories
			.splice(0)
			.map((path) => rm(path, { recursive: true, force: true })),
	);
});

describe("release verification receipts", () => {
	it("records and reuses a successful clean candidate by exact tree", async () => {
		const repositoryRoot = await createRepository();
		const recorded = await recordReleaseReceipt(
			repositoryRoot,
			new Date("2026-08-31T12:00:00.000Z"),
		);

		expect(recorded.recorded).toBe(true);
		const verified = await verifyReleaseReceipt(repositoryRoot, {
			now: new Date("2026-08-31T13:00:00.000Z"),
		});
		expect(verified.receipt.tree).toBe(
			readReleaseCandidateState(repositoryRoot).tree,
		);
	});

	it("rejects dirty, changed, stale, and missing candidates", async () => {
		const repositoryRoot = await createRepository();
		const candidate = readReleaseCandidateState(repositoryRoot);
		const verifiedAt = new Date("2026-08-31T12:00:00.000Z");
		const receipt = makeReleaseReceipt({ candidate, now: verifiedAt });

		expect(() =>
			validateReleaseReceipt({
				receipt,
				candidate: { ...candidate, tree: "different-tree" },
				now: verifiedAt,
			}),
		).toThrow("does not match verified tree");
		expect(() =>
			validateReleaseReceipt({
				receipt,
				candidate: { ...candidate, status: " M candidate.txt" },
				now: verifiedAt,
			}),
		).toThrow("clean working tree");
		expect(() =>
			validateReleaseReceipt({
				receipt,
				candidate,
				now: new Date(
					verifiedAt.getTime() + DEFAULT_RECEIPT_MAX_AGE_MILLISECONDS + 1,
				),
			}),
		).toThrow("receipt is stale");
		await expect(verifyReleaseReceipt(repositoryRoot)).rejects.toThrow(
			"No reusable Release Check exists",
		);
	});

	it("invalidates a prior receipt before a rerun can fail", async () => {
		const repositoryRoot = await createRepository();
		await recordReleaseReceipt(repositoryRoot);
		await invalidateReleaseReceipt(repositoryRoot);

		await expect(verifyReleaseReceipt(repositoryRoot)).rejects.toThrow(
			"No reusable Release Check exists",
		);
	});

	it("proves promoted merge commits preserve the verified tree", async () => {
		const repositoryRoot = await createRepository();
		runGit(repositoryRoot, ["tag", "verified-candidate"]);

		expect(
			verifyMatchingGitTrees(repositoryRoot, "verified-candidate").currentTree,
		).toBe(readReleaseCandidateState(repositoryRoot).tree);

		await writeFile(join(repositoryRoot, "candidate.txt"), "changed\n");
		runGit(repositoryRoot, ["add", "candidate.txt"]);
		runGit(repositoryRoot, ["commit", "--quiet", "-m", "changed"]);
		expect(() =>
			verifyMatchingGitTrees(repositoryRoot, "verified-candidate"),
		).toThrow("does not match");
	});
});
