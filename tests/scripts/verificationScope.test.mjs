import { execFileSync, spawnSync } from "node:child_process";
import {
	copyFileSync,
	chmodSync,
	existsSync,
	symlinkSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
	renameSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
	classifyVerificationDiff,
	readVerificationScope,
	readLocalVerificationScope,
} from "../../scripts/lib/quality/verification_scope.mjs";

const oldObject = "1".repeat(40);
const newObject = "2".repeat(40);
const rawChange = (
	path,
	{ status = "M", oldMode = "100644", newMode = "100644" } = {},
) =>
	`:${oldMode} ${newMode} ${status === "A" ? "0".repeat(40) : oldObject} ${newObject} ${status}\0${path}\0`;

describe("documentation verification scope", () => {
	it.each([
		"README.md",
		"scripts/README.md",
		"docs/README.md",
		"docs/user/README.md",
		"docs/development/testing.md",
	])("recognizes regular added or modified documentation at %s", (path) => {
		expect(classifyVerificationDiff(rawChange(path))).toBe("documentation");
		expect(
			classifyVerificationDiff(
				rawChange(path, { status: "A", oldMode: "000000" }),
			),
		).toBe("documentation");
	});

	it.each([
		"src/routes/+page.svelte",
		"package.json",
		"package-lock.json",
		".nvmrc",
		".github/workflows/verify.yml",
		"config/documentation/site.css",
		"scripts/lib/documentation/render_markdown.mjs",
		"tests/config/documentationSite.test.ts",
		"docs/workspace/project/project-board.md",
		"docs/development/notes/private.md",
		"docs/user/nested/Notes/private.md",
		"docs/development/workspace/private.md",
		"docs/user/nested/WORKSPACE/private.md",
		"unknown.md",
		"docs/user/../source.md",
		"docs/user/.private/source.md",
		"docs/user/line\nbreak.md",
	])("retains source checks for %s", (path) => {
		expect(classifyVerificationDiff(rawChange(path))).toBe("source");
		expect(
			classifyVerificationDiff(rawChange("README.md") + rawChange(path)),
		).toBe("source");
	});

	it.each([
		{ status: "A", oldMode: "000000", newMode: "100755" },
		{ status: "M", oldMode: "100644", newMode: "100755" },
		{ status: "M", oldMode: "100755", newMode: "100644" },
		{ status: "A", oldMode: "000000", newMode: "120000" },
		{ status: "M", oldMode: "120000", newMode: "120000" },
		{ status: "M", oldMode: "160000", newMode: "160000" },
		{ status: "D", oldMode: "100644", newMode: "000000" },
		{ status: "T", oldMode: "100644", newMode: "120000" },
		{ status: "A", oldMode: "100644", newMode: "100644" },
	])("retains source checks for non-prose metadata %j", (metadata) => {
		expect(classifyVerificationDiff(rawChange("README.md", metadata))).toBe(
			"source",
		);
	});

	it.each([
		"",
		"M\0README.md\0",
		`:100644 100644 ${oldObject} ${newObject} M\0README.md`,
		`:100644 100644 ${oldObject} ${newObject} M\0\0`,
		`:100644 100644 ${oldObject} ${newObject} R100\0README.md\0docs/user/README.md\0`,
		`:100644 100644 ${oldObject} ${newObject} C100\0README.md\0docs/user/README.md\0`,
		`:100644 100644 ${oldObject} ${newObject} M100\0README.md\0`,
		`:100644 100644 ${"0".repeat(40)} ${newObject} M\0README.md\0`,
		`:100644 100644 ${oldObject} ${newObject}BAD M\0README.md\0`,
		null,
	])(
		"retains source checks for incomplete or uncertain inventory %j",
		(output) => {
			expect(classifyVerificationDiff(output)).toBe("source");
		},
	);

	it("uses the actual comparison and refuses missing bases or renamed documentation", () => {
		const root = mkdtempSync(join(tmpdir(), "blendcalc-verification-scope-"));
		// The caller's comparison belongs to its checkout, not this isolated Git fixture.
		const inheritedBase = process.env.TEST_BASE_REF;
		delete process.env.TEST_BASE_REF;
		const git = (...args) =>
			execFileSync(
				"git",
				[
					"-c",
					"core.hooksPath=/dev/null",
					"-c",
					"core.fsmonitor=false",
					"-c",
					"core.fileMode=true",
					...args,
				],
				{
					cwd: root,
					encoding: "utf8",
					stdio: ["ignore", "pipe", "ignore"],
					env: {
						...process.env,
						GIT_CONFIG_COUNT: "0",
						GIT_CONFIG_GLOBAL: "/dev/null",
						GIT_CONFIG_NOSYSTEM: "1",
						GIT_AUTHOR_NAME: "Fixture",
						GIT_COMMITTER_NAME: "Fixture",
						GIT_AUTHOR_EMAIL: "fixture@example.invalid",
						GIT_COMMITTER_EMAIL: "fixture@example.invalid",
					},
				},
			);
		try {
			git("init", "-q");
			writeFileSync(join(root, "README.md"), "Original documentation.\n");
			writeFileSync(join(root, ".gitattributes"), "*.md diff=probe\n");
			git("add", "README.md", ".gitattributes");
			git("commit", "-qm", "Initial fixture");
			const base = git("rev-parse", "HEAD").trim();
			writeFileSync(
				join(root, ".git/reject-command.sh"),
				"#!/bin/sh\nprintf invoked > .git/driver-called\nexit 99\n",
			);
			for (const key of [
				"core.fsmonitor",
				"diff.external",
				"diff.probe.textconv",
			]) {
				git("config", key, "sh .git/reject-command.sh");
			}
			writeFileSync(join(root, "README.md"), "Updated documentation.\n");
			git("add", "README.md");
			git("commit", "-qm", "Update documentation");
			expect(
				readVerificationScope({ comparisonBase: base, repositoryRoot: root }),
			).toBe("documentation");
			git("branch", "staging", base);
			process.env.TEST_BASE_REF = "f".repeat(40);
			expect(readLocalVerificationScope({ repositoryRoot: root })).toBe(
				"source",
			);
			delete process.env.TEST_BASE_REF;
			expect(readLocalVerificationScope({ repositoryRoot: root })).toBe(
				"documentation",
			);
			expect(existsSync(join(root, ".git/driver-called"))).toBe(false);
			mkdirSync(join(root, "docs/user"), { recursive: true });
			const addition = join(root, "docs/user/added.md");
			writeFileSync(addition, "Additional public prose.\n");
			expect(readLocalVerificationScope({ repositoryRoot: root })).toBe(
				"documentation",
			);
			chmodSync(addition, 0o700);
			expect(readLocalVerificationScope({ repositoryRoot: root })).toBe(
				"source",
			);
			chmodSync(addition, 0o600);
			git("add", "docs/user/added.md");
			git("commit", "-qm", "Add regular public prose");
			expect(
				readVerificationScope({ comparisonBase: base, repositoryRoot: root }),
			).toBe("documentation");
			const linked = join(root, "docs/user/linked.md");
			symlinkSync("../../README.md", linked);
			expect(readLocalVerificationScope({ repositoryRoot: root })).toBe(
				"source",
			);
			rmSync(linked);
			mkdirSync(join(root, "docs/user/notes"));
			writeFileSync(
				join(root, "docs/user/notes/private.md"),
				"Synthetic private fixture.\n",
			);
			expect(readLocalVerificationScope({ repositoryRoot: root })).toBe(
				"source",
			);
			rmSync(join(root, "docs/user/notes"), { recursive: true });
			git("config", "core.fileMode", "false");
			chmodSync(join(root, "README.md"), 0o700);
			expect(readLocalVerificationScope({ repositoryRoot: root })).toBe(
				"source",
			);
			chmodSync(join(root, "README.md"), 0o600);
			writeFileSync(join(root, "package.json"), "{}\n");
			expect(readLocalVerificationScope({ repositoryRoot: root })).toBe(
				"source",
			);
			rmSync(join(root, "package.json"));
			writeFileSync(
				join(root, "README.md"),
				"Another local documentation edit.\n",
			);
			expect(readLocalVerificationScope({ repositoryRoot: root })).toBe(
				"documentation",
			);
			git("restore", "README.md");
			const current = git("rev-parse", "HEAD").trim();
			expect(
				readVerificationScope({
					comparisonBase: current,
					repositoryRoot: root,
				}),
			).toBe("source");
			expect(
				readVerificationScope({
					comparisonBase: "f".repeat(40),
					repositoryRoot: root,
				}),
			).toBe("source");
			expect(
				readVerificationScope({
					comparisonBase: "--unsafe",
					repositoryRoot: root,
				}),
			).toBe("source");
			mkdirSync(join(root, "docs/user"), { recursive: true });
			renameSync(join(root, "README.md"), join(root, "docs/user/README.md"));
			git("add", "-A");
			git("commit", "-qm", "Rename documentation");
			expect(
				readVerificationScope({
					comparisonBase: current,
					repositoryRoot: root,
				}),
			).toBe("source");
		} finally {
			if (inheritedBase === undefined) delete process.env.TEST_BASE_REF;
			else process.env.TEST_BASE_REF = inheritedBase;
			rmSync(root, { recursive: true, force: true });
		}
	});

	it.each([
		{
			name: "chmod of existing Markdown",
			change: (root) => chmodSync(join(root, "README.md"), 0o700),
		},
		{
			name: "added executable Markdown",
			change: (root) =>
				writeFileSync(
					join(root, "docs/user/executable.md"),
					"Executable fixture.\n",
					{ mode: 0o700 },
				),
		},
		{
			name: "added symlink Markdown",
			change: (root) =>
				symlinkSync("../../README.md", join(root, "docs/user/reference.md")),
		},
		{
			name: "modified symlink Markdown",
			prepare: (root) =>
				symlinkSync("../../README.md", join(root, "docs/user/reference.md")),
			change: (root) => {
				rmSync(join(root, "docs/user/reference.md"));
				symlinkSync("../../missing.md", join(root, "docs/user/reference.md"));
			},
		},
		{
			name: "replacement of regular Markdown with a symlink",
			change: (root) => {
				rmSync(join(root, "README.md"));
				symlinkSync("missing.md", join(root, "README.md"));
			},
		},
		{
			name: "deleted Markdown",
			change: (root) => rmSync(join(root, "README.md")),
		},
	])(
		"retains source checks for actual Git metadata: $name",
		({ prepare, change }) => {
			const root = mkdtempSync(
				join(tmpdir(), "blendcalc-verification-metadata-"),
			);
			const git = (...args) =>
				execFileSync(
					"git",
					[
						"-c",
						"core.hooksPath=/dev/null",
						"-c",
						"core.fsmonitor=false",
						"-c",
						"core.fileMode=true",
						...args,
					],
					{
						cwd: root,
						encoding: "utf8",
						stdio: ["ignore", "pipe", "ignore"],
						env: {
							...process.env,
							GIT_CONFIG_COUNT: "0",
							GIT_CONFIG_GLOBAL: "/dev/null",
							GIT_CONFIG_NOSYSTEM: "1",
							GIT_AUTHOR_NAME: "Fixture",
							GIT_COMMITTER_NAME: "Fixture",
							GIT_AUTHOR_EMAIL: "fixture@example.invalid",
							GIT_COMMITTER_EMAIL: "fixture@example.invalid",
						},
					},
				);
			try {
				git("init", "-q");
				mkdirSync(join(root, "docs/user"), { recursive: true });
				writeFileSync(join(root, "README.md"), "Original documentation.\n");
				prepare?.(root);
				git("add", ".");
				git("commit", "-qm", "Initial metadata fixture");
				const base = git("rev-parse", "HEAD").trim();
				git("branch", "staging", base);
				change(root);
				git("add", "-A");
				git("commit", "-qm", "Change metadata fixture");
				expect(
					readVerificationScope({ comparisonBase: base, repositoryRoot: root }),
				).toBe("source");
				expect(readLocalVerificationScope({ repositoryRoot: root })).toBe(
					"source",
				);
			} finally {
				rmSync(root, { recursive: true, force: true });
			}
		},
	);

	it("executes the existing CI planner without audits for scope selection", () => {
		const root = mkdtempSync(join(tmpdir(), "blendcalc-verification-plan-"));
		const repositoryRoot = join(root, "repository");
		const origin = join(root, "origin.git");
		const bin = join(root, "bin");
		mkdirSync(repositoryRoot);
		mkdirSync(bin);
		const environment = {
			...process.env,
			PATH: `${bin}:${process.env.PATH}`,
			GIT_CONFIG_COUNT: "0",
			GIT_CONFIG_GLOBAL: "/dev/null",
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_AUTHOR_NAME: "Fixture",
			GIT_COMMITTER_NAME: "Fixture",
			GIT_AUTHOR_EMAIL: "fixture@example.invalid",
			GIT_COMMITTER_EMAIL: "fixture@example.invalid",
		};
		const git = (...args) =>
			execFileSync(
				"git",
				[
					"-c",
					"core.hooksPath=/dev/null",
					"-c",
					"core.fsmonitor=false",
					"-c",
					"core.fileMode=true",
					...args,
				],
				{
					cwd: repositoryRoot,
					env: environment,
					encoding: "utf8",
					stdio: ["ignore", "pipe", "ignore"],
				},
			);
		const workflow = readFileSync(
			new URL("../../.github/workflows/verify.yml", import.meta.url),
			"utf8",
		);
		const script = workflow
			.split("        run: |\n")[1]
			.split("\n  preflight:")[0]
			.split("\n")
			.map((line) => line.slice(10))
			.join("\n");
		const plan = (overrides) => {
			const output = join(root, "output");
			writeFileSync(output, "");
			execFileSync("bash", ["-e", "-o", "pipefail", "-c", script], {
				cwd: repositoryRoot,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
				env: {
					...environment,
					EVENT_NAME: "pull_request",
					HEAD_REF: "feature/fixture",
					REF_NAME: "fixture",
					REQUESTED_SCOPE: "",
					BEFORE_SHA: "",
					GITHUB_OUTPUT: output,
					...overrides,
				},
			});
			return Object.fromEntries(
				readFileSync(output, "utf8")
					.trim()
					.split("\n")
					.map((line) => line.split("=")),
			);
		};
		try {
			for (const command of ["gh", "npm"])
				writeFileSync(join(bin, command), "#!/bin/sh\nexit 91\n", {
					mode: 0o700,
				});
			git("init", "-q");
			git("init", "--bare", "-q", origin);
			git("remote", "add", "origin", origin);
			mkdirSync(join(repositoryRoot, "scripts/lib/quality"), {
				recursive: true,
			});
			for (const file of [
				"verification_scope.mjs",
				"release_verification_receipt.mjs",
			]) {
				copyFileSync(
					new URL(`../../scripts/lib/quality/${file}`, import.meta.url),
					join(repositoryRoot, "scripts/lib/quality", file),
				);
			}
			writeFileSync(
				join(repositoryRoot, "README.md"),
				"Original documentation.\n",
			);
			git("add", ".");
			git("commit", "-qm", "Initial fixture");
			const base = git("rev-parse", "HEAD").trim();
			git("push", "-q", "origin", "HEAD:staging");
			writeFileSync(
				join(repositoryRoot, "README.md"),
				"Updated documentation.\n",
			);
			git("add", ".");
			git("commit", "-qm", "Documentation fixture");
			expect(plan({ PR_BASE_SHA: base })).toMatchObject({
				mode: "documentation",
				dependencies: "false",
				"comparison-base": base,
			});
			expect(
				plan({
					EVENT_NAME: "workflow_dispatch",
					REQUESTED_SCOPE: "full",
					PR_BASE_SHA: base,
				}),
			).toMatchObject({ mode: "full", dependencies: "true" });
			writeFileSync(
				join(repositoryRoot, "runtime.js"),
				"export const fixture = true;\n",
			);
			git("add", ".");
			git("commit", "-qm", "Runtime fixture");
			expect(plan({ PR_BASE_SHA: base })).toMatchObject({
				mode: "feature",
				dependencies: "false",
			});
			git("push", "-q", "origin", "HEAD:staging");
			expect(
				plan({ EVENT_NAME: "push", REF_NAME: "main", BEFORE_SHA: base }),
			).toMatchObject({
				mode: "reuse",
				dependencies: "true",
				"comparison-base": "origin/staging",
			});
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	}, 30_000);
});

describe("selected release candidate discovery", () => {
	const repository = "Fixture/repository";
	const workflow = readFileSync(
		new URL("../../.github/workflows/verify.yml", import.meta.url),
		"utf8",
	);
	const script = workflow
		.split("        run: |\n")[1]
		.split("\n  preflight:")[0]
		.split("\n")
		.map((line) => line.slice(10))
		.join("\n");

	const withFixture = (check) => {
		const root = mkdtempSync(join(tmpdir(), "blendcalc-candidate-discovery-"));
		const checkout = join(root, "repository");
		const origin = join(root, "origin.git");
		const bin = join(root, "bin");
		const evidence = join(root, "evidence.json");
		const calls = join(root, "calls.jsonl");
		mkdirSync(checkout);
		mkdirSync(bin);
		const environment = {
			...Object.fromEntries(
				Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
			),
			PATH: `${bin}:${process.env.PATH}`,
			GIT_CONFIG_COUNT: "0",
			GIT_CONFIG_GLOBAL: "/dev/null",
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_AUTHOR_NAME: "Fixture",
			GIT_COMMITTER_NAME: "Fixture",
			GIT_AUTHOR_EMAIL: "fixture@example.invalid",
			GIT_COMMITTER_EMAIL: "fixture@example.invalid",
			FAKE_GH_EVIDENCE: evidence,
			FAKE_GH_CALLS: calls,
		};
		const git = (...args) =>
			execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
				cwd: checkout,
				env: environment,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
				timeout: 10_000,
				maxBuffer: 1024 * 1024,
			}).trim();
		try {
			writeFileSync(
				join(bin, "gh"),
				`#!${process.execPath}
import { appendFileSync, readFileSync } from "node:fs";
const [command, path] = process.argv.slice(2);
appendFileSync(process.env.FAKE_GH_CALLS, JSON.stringify(path) + "\\n");
const data = JSON.parse(readFileSync(process.env.FAKE_GH_EVIDENCE, "utf8"));
if (command !== "api" || data.unavailable) {
  console.error("private-api-body-must-not-be-printed");
  process.exit(69);
}
if (data.invalidJSON) {
  console.log("private-invalid-api-body");
  process.exit(0);
}
const endpoint = new URL(path, "https://fixture.invalid/");
const prefix = "repos/${repository}/";
if (endpoint.pathname === "/" + prefix + "actions/workflows/verify.yml/runs" &&
    /^[0-9a-f]{40}$/.test(endpoint.searchParams.get("head_sha") ?? "") &&
    endpoint.searchParams.get("event") === "workflow_dispatch" &&
    endpoint.searchParams.get("status") === "success" &&
    endpoint.searchParams.get("per_page") === "20") {
  console.log(JSON.stringify({ workflow_runs: data.runs[endpoint.searchParams.get("head_sha")] ?? [] }));
} else {
  const match = endpoint.pathname.match(/^\\/repos\\/Fixture\\/repository\\/commits\\/([0-9a-f]{40})\\/pulls$/);
  if (!match || endpoint.searchParams.get("per_page") !== "10") process.exit(91);
  console.log(JSON.stringify(data.pulls[match[1]] ?? []));
}
`,
				{ mode: 0o700 },
			);
			writeFileSync(join(bin, "npm"), "#!/bin/sh\nexit 92\n", {
				mode: 0o700,
			});
			git("init", "-q");
			git("init", "--bare", "-q", origin);
			git("remote", "add", "origin", origin);
			mkdirSync(join(checkout, "scripts/lib/quality"), { recursive: true });
			for (const file of [
				"verification_scope.mjs",
				"release_verification_receipt.mjs",
			]) {
				copyFileSync(
					new URL(`../../scripts/lib/quality/${file}`, import.meta.url),
					join(checkout, "scripts/lib/quality", file),
				);
			}
			writeFileSync(join(checkout, "runtime.js"), "export const value = 0;\n");
			git("add", ".");
			git("commit", "-qm", "Base fixture");
			const base = git("rev-parse", "HEAD");
			git("push", "-q", "origin", "HEAD:mock-staging");
			writeFileSync(join(checkout, "runtime.js"), "export const value = 1;\n");
			git("add", ".");
			git("commit", "-qm", "Fully verified source fixture");
			const source = git("rev-parse", "HEAD");
			git("checkout", "-qb", "staging", base);
			writeFileSync(join(checkout, "runtime.js"), "export const value = 1;\n");
			git("add", ".");
			git("commit", "-qm", "Squashed source fixture");
			const staged = git("rev-parse", "HEAD");
			git("push", "-q", "origin", "HEAD:staging");
			const proof = {
				id: 1,
				head_sha: source,
				repository: { full_name: repository },
				event: "workflow_dispatch",
				display_title: "Verify (full)",
				status: "completed",
				conclusion: "success",
			};
			const pull = {
				merged_at: "2026-11-03T08:00:00Z",
				merge_commit_sha: staged,
				base: { repo: { full_name: repository } },
				head: { sha: source, repo: { full_name: repository } },
			};
			const data = { runs: { [source]: [proof] }, pulls: { [staged]: [pull] } };
			const plan = (overrides = {}) => {
				writeFileSync(evidence, JSON.stringify(data));
				writeFileSync(calls, "");
				const output = join(root, "output");
				writeFileSync(output, "");
				const result = spawnSync(
					"bash",
					["-e", "-o", "pipefail", "-c", script],
					{
						cwd: checkout,
						encoding: "utf8",
						timeout: 20_000,
						maxBuffer: 1024 * 1024,
						stdio: ["ignore", "pipe", "pipe"],
						env: {
							...environment,
							GITHUB_REPOSITORY: repository,
							GITHUB_OUTPUT: output,
							EVENT_NAME: "push",
							REF_NAME: "staging",
							BEFORE_SHA: base,
							PR_BASE_SHA: "",
							HEAD_REF: "",
							REQUESTED_SCOPE: "",
							...overrides,
						},
					},
				);
				return {
					status: result.status ?? 1,
					stdout: result.stdout ?? "",
					stderr: result.stderr ?? "",
					outputs: Object.fromEntries(
						readFileSync(output, "utf8")
							.trim()
							.split("\n")
							.filter(Boolean)
							.map((line) => line.split("=")),
					),
					calls: readFileSync(calls, "utf8")
						.trim()
						.split("\n")
						.filter(Boolean)
						.map((line) => JSON.parse(line)),
				};
			};
			check({ checkout, git, base, source, staged, data, proof, pull, plan });
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	};

	it("reuses the exact merged PR source after a squash without a recent-run index", () => {
		withFixture(({ source, staged, plan }) => {
			const result = plan();
			expect(result.status).toBe(0);
			expect(result.outputs).toMatchObject({
				mode: "reuse",
				dependencies: "true",
				"comparison-base": source,
			});
			expect(result.calls).toContain(
				`repos/${repository}/commits/${staged}/pulls?per_page=10`,
			);
			expect(result.calls).toHaveLength(3);
			expect(result.calls.every((path) => !path.includes("per_page=50"))).toBe(
				true,
			);
			expect(result.calls.some((path) => path.includes("head_sha=HEAD"))).toBe(
				false,
			);
		});
	}, 30_000);

	it("discovers the same source through the staging parent of a main promotion merge", () => {
		withFixture(({ git, base, source, staged, plan }) => {
			git("checkout", "-qb", "release/main", base);
			git("merge", "--no-ff", "-qm", "Promote staging fixture", staged);
			const result = plan({
				EVENT_NAME: "pull_request",
				HEAD_REF: "release/main",
				REF_NAME: "108/merge",
				PR_BASE_SHA: base,
			});
			expect(result.status).toBe(0);
			expect(result.outputs).toMatchObject({
				mode: "reuse",
				"comparison-base": source,
			});
			expect(result.calls).toContain(
				`repos/${repository}/commits/${staged}/pulls?per_page=10`,
			);
			expect(result.calls).toHaveLength(5);
		});
	}, 30_000);

	it("uses an exact verified HEAD before requesting any PR links", () => {
		withFixture(({ staged, data, proof, plan }) => {
			data.runs[staged] = [{ ...proof, head_sha: staged }];
			const result = plan();
			expect(result.status).toBe(0);
			expect(result.outputs["comparison-base"]).toBe(staged);
			expect(result.calls).toHaveLength(1);
		});
	}, 30_000);

	it.each([
		["divergent source", ({ pull, base }) => (pull.head.sha = base)],
		["missing source object", ({ pull }) => (pull.head.sha = "f".repeat(40))],
		[
			"feature-only proof",
			({ proof }) => (proof.display_title = "Verify (feature)"),
		],
		["failed proof", ({ proof }) => (proof.conclusion = "failure")],
		[
			"wrong merge identity",
			({ pull, base }) => (pull.merge_commit_sha = base),
		],
		["unmerged PR", ({ pull }) => (pull.merged_at = null)],
		["malformed source identity", ({ pull }) => (pull.head.sha = "HEAD")],
		["wrong proof SHA", ({ proof }) => (proof.head_sha = "e".repeat(40))],
		[
			"wrong proof repository",
			({ proof }) => (proof.repository.full_name = "Unrelated/repository"),
		],
		["unavailable API", ({ data }) => (data.unavailable = true)],
		["invalid API JSON", ({ data }) => (data.invalidJSON = true)],
		[
			"excessive PR links",
			({ data, staged, pull }) => (data.pulls[staged] = Array(11).fill(pull)),
		],
		[
			"dirty working tree",
			({ checkout }) =>
				writeFileSync(join(checkout, "runtime.js"), "Dirty fixture.\n"),
		],
	])(
		"retains full staging verification for %s",
		(_name, change) => {
			withFixture((fixture) => {
				change(fixture);
				const result = fixture.plan();
				expect(result.status).toBe(0);
				expect(result.outputs).toMatchObject({
					mode: "full",
					dependencies: "true",
					"comparison-base": fixture.base,
				});
				expect(result.stdout + result.stderr).not.toContain(
					"private-api-body-must-not-be-printed",
				);
				expect(result.stdout + result.stderr).not.toContain(
					"private-invalid-api-body",
				);
				expect(result.stderr).toContain("Verification candidate ");
			});
		},
		30_000,
	);

	it("refuses release review when no exact full proof exists", () => {
		withFixture(({ base, proof, plan }) => {
			proof.display_title = "Verify (feature)";
			const result = plan({
				EVENT_NAME: "pull_request",
				HEAD_REF: "release/candidate",
				PR_BASE_SHA: base,
			});
			expect(result.status).toBe(1);
			expect(result.outputs).toEqual({});
			expect(result.stdout).toContain(
				"Release review requires a successful full dispatch",
			);
		});
	}, 30_000);
});
