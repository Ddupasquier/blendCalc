import { execFileSync, spawnSync } from "node:child_process";
import {
	copyFileSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { load } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";

const workflow = load(readFileSync(".github/workflows/verify.yml", "utf8"));
const planningShell = workflow.jobs["verification-plan"].steps.find(
	(step) => step.id === "plan",
).run;
const gateShell = workflow.jobs["browser-gate"].steps[0].run;
const selectorPath = "scripts/operations/quality/run_affected_tests.mjs";
const temporaryRepositories = [];

const git = (root, ...args) =>
	execFileSync("git", args, {
		cwd: root,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();

const createFixture = (changedPaths) => {
	const root = mkdtempSync(join(tmpdir(), "blendcalc-browser-routing-"));
	temporaryRepositories.push(root);
	mkdirSync(dirname(join(root, selectorPath)), { recursive: true });
	copyFileSync(resolve(selectorPath), join(root, selectorPath));
	const commandGuards = join(root, "command-guards");
	mkdirSync(commandGuards);
	for (const command of ["npm", "npx"]) {
		writeFileSync(join(commandGuards, command), "#!/bin/sh\nexit 97\n", {
			mode: 0o755,
		});
	}
	git(root, "init", "--quiet", "--initial-branch=staging");
	git(root, "config", "user.name", "Browser Routing Fixture");
	git(root, "config", "user.email", "routing@blendcalc.local");
	git(root, "config", "commit.gpgsign", "false");
	git(root, "config", "core.hooksPath", "/dev/null");
	git(root, "add", ".");
	git(root, "commit", "--quiet", "-m", "fixture baseline");
	git(root, "remote", "add", "origin", root);
	git(root, "switch", "--quiet", "-c", "fixture-change");
	for (const path of changedPaths) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), "fixture change\n");
	}
	return {
		root,
		env: {
			PATH: `${commandGuards}:${process.env.PATH}`,
			BEFORE_SHA: "",
			EVENT_NAME: "pull_request",
			PR_BASE_SHA: git(root, "rev-parse", "staging"),
			REF_NAME: "fixture-change",
			REQUESTED_SCOPE: "",
			GITHUB_OUTPUT: join(root, "plan-output"),
		},
	};
};

const readOutput = (fixture) =>
	Object.fromEntries(
		readFileSync(fixture.env.GITHUB_OUTPUT, "utf8")
			.trim()
			.split("\n")
			.map((line) => line.split("=")),
	);

const createSquashedFixture = () => {
	const fixture = createFixture([]);
	const promotionPath =
		"scripts/operations/quality/verify_release_promotion.mjs";
	writeFileSync(
		join(fixture.root, promotionPath),
		`import { verifyMatchingGitTrees } from ${JSON.stringify(
			resolve("scripts/lib/quality/release_verification_receipt.mjs"),
		)};\nverifyMatchingGitTrees(process.cwd(), process.argv[3]);\n`,
	);
	writeFileSync(
		join(fixture.root, "command-guards/gh"),
		`#!/bin/sh
case "$2" in
  *event=workflow_dispatch*)
    if [ "$FIXTURE_DISCOVERY_ERROR" = true ]; then exit 7; fi
    if [ "$FIXTURE_ADVERTISE" = true ]; then printf '%s\\n' "$FIXTURE_VERIFIED_SHA"; fi
    ;;
  *head_sha=*)
    case "$2" in
      *"head_sha=$FIXTURE_VERIFIED_SHA&"*)
        if [ "$FIXTURE_FULL_PASSED" = true ]; then echo 1; else echo 0; fi
        ;;
      *) echo 0 ;;
    esac
    ;;
  *) exit 8 ;;
esac
`,
		{ mode: 0o755 },
	);
	writeFileSync(
		join(fixture.root, ".gitignore"),
		"plan-output\ntest-results/\n",
	);
	git(fixture.root, "add", ".");
	git(fixture.root, "commit", "--quiet", "-m", "fixture planning support");
	git(fixture.root, "branch", "--force", "staging", "HEAD");
	const baseline = git(fixture.root, "rev-parse", "HEAD");
	writeFileSync(join(fixture.root, "candidate.txt"), "verified content\n");
	git(fixture.root, "add", "candidate.txt");
	git(fixture.root, "commit", "--quiet", "-m", "verified feature");
	const verified = git(fixture.root, "rev-parse", "HEAD");
	git(fixture.root, "switch", "--quiet", "staging");
	git(fixture.root, "merge", "--squash", "fixture-change");
	git(fixture.root, "commit", "--quiet", "-m", "squashed promotion");
	return {
		...fixture,
		verified,
		env: {
			...fixture.env,
			EVENT_NAME: "push",
			REF_NAME: "staging",
			BEFORE_SHA: baseline,
			GITHUB_REPOSITORY: "fixture/owned-repository",
			FIXTURE_VERIFIED_SHA: verified,
			FIXTURE_ADVERTISE: "true",
			FIXTURE_FULL_PASSED: "true",
		},
	};
};

afterEach(() => {
	for (const root of temporaryRepositories.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("real workflow browser routing", () => {
	it("reuses a successful full candidate after squash without parent identity", () => {
		const fixture = createSquashedFixture();
		expect(git(fixture.root, "rev-parse", "HEAD")).not.toBe(fixture.verified);
		expect(
			git(fixture.root, "show", "-s", "--format=%P", "HEAD"),
		).not.toContain(fixture.verified);
		const result = spawnSync("bash", ["-e", "-c", planningShell], {
			cwd: fixture.root,
			env: fixture.env,
			encoding: "utf8",
		});
		expect(result.status, result.stderr).toBe(0);
		expect(readOutput(fixture)).toMatchObject({
			mode: "reuse",
			dependencies: "true",
			"comparison-base": fixture.verified,
		});
	});

	it.each(["changed", "dirty", "untracked", "missing", "unproven", "unknown"])(
		"does not reuse a %s squash candidate",
		(control) => {
			const fixture = createSquashedFixture();
			if (control === "changed" || control === "dirty") {
				writeFileSync(join(fixture.root, "candidate.txt"), "changed content\n");
				if (control === "changed") {
					git(fixture.root, "add", "candidate.txt");
					git(fixture.root, "commit", "--quiet", "-m", "later content");
				}
			}
			if (control === "untracked")
				writeFileSync(join(fixture.root, "unreviewed.txt"), "new content\n");
			if (control === "missing") fixture.env.FIXTURE_ADVERTISE = "false";
			if (control === "unproven") fixture.env.FIXTURE_FULL_PASSED = "false";
			if (control === "unknown")
				fixture.env.FIXTURE_VERIFIED_SHA = "0".repeat(40);
			const result = spawnSync("bash", ["-e", "-c", planningShell], {
				cwd: fixture.root,
				env: fixture.env,
				encoding: "utf8",
			});
			expect(result.status, result.stderr).toBe(0);
			expect(readOutput(fixture).mode).toBe("full");
		},
	);

	it("fails closed when successful-candidate discovery is unavailable", () => {
		const fixture = createSquashedFixture();
		const result = spawnSync("bash", ["-e", "-c", planningShell], {
			cwd: fixture.root,
			env: { ...fixture.env, FIXTURE_DISCOVERY_ERROR: "true" },
			encoding: "utf8",
		});
		expect(result.status).toBe(7);
		expect(result.stdout).not.toContain(
			"Reusing the successful full verification",
		);
	});

	it.each([
		[
			"src/lib/components/common/SegmentedControl/SegmentedControl.scss",
			"full",
		],
		["src/routes/+layout.svelte", "full"],
		["src/styles/_variables.scss", "full"],
		["tests/e2e/support/browserTest.ts", "full"],
		["playwright.config.ts", "full"],
		["src/routes/profile/+page.svelte", "feature"],
		["src/routes/ingredients/+page.svelte", "feature"],
		["tests/e2e/nutritionServingSelector.spec.ts", "feature"],
		["docs/README.md", "feature"],
	])("routes %s to %s without installing or running tests", (path, mode) => {
		const fixture = createFixture([path]);
		const result = spawnSync("bash", ["-e", "-c", planningShell], {
			cwd: fixture.root,
			env: fixture.env,
			encoding: "utf8",
		});
		expect(result.status, result.stderr).toBe(0);
		expect(readOutput(fixture)).toMatchObject({
			mode,
			dependencies: mode === "full" ? "true" : "false",
		});
		const report = JSON.parse(
			readFileSync(
				join(fixture.root, "test-results/affected-test-selection.json"),
				"utf8",
			),
		);
		expect(report.changedFiles).toEqual([path]);
		expect(report.browserSelection.projects).toEqual(
			mode === "full" ? [] : ["desktop-chromium", "mobile-chromium"],
		);
	});

	it("keeps an explicitly requested full run full without affected planning", () => {
		const fixture = createFixture(["docs/README.md"]);
		const result = spawnSync("bash", ["-e", "-c", planningShell], {
			cwd: fixture.root,
			env: {
				...fixture.env,
				EVENT_NAME: "workflow_dispatch",
				REQUESTED_SCOPE: "full",
			},
			encoding: "utf8",
		});
		expect(result.status, result.stderr).toBe(0);
		expect(readOutput(fixture)).toMatchObject({
			mode: "full",
			dependencies: "true",
		});
	});

	it.each(["all", "browser", "unit"])(
		"makes plan-only take precedence over preparation and installation in %s mode",
		(mode) => {
			const fixture = createFixture(["src/routes/profile/+page.svelte"]);
			const result = spawnSync(
				process.execPath,
				[selectorPath, mode, "--plan-only", "--prepare", "--install-browsers"],
				{
					cwd: fixture.root,
					env: { ...fixture.env, TEST_BASE_REF: "staging" },
					encoding: "utf8",
				},
			);
			expect(result.status, result.stderr).toBe(0);
			expect(
				JSON.parse(
					readFileSync(
						join(fixture.root, "test-results/affected-test-selection.json"),
						"utf8",
					),
				).browserSelection.reason,
			).toBe("domain owners changed");
		},
	);

	it("detects committed and working-tree shared owners together", () => {
		const fixture = createFixture(["docs/README.md"]);
		git(fixture.root, "add", "docs/README.md");
		git(fixture.root, "commit", "--quiet", "-m", "fixture docs change");
		mkdirSync(join(fixture.root, "src/styles"), { recursive: true });
		writeFileSync(join(fixture.root, "src/styles/_themes.scss"), "change\n");
		const result = spawnSync("bash", ["-e", "-c", planningShell], {
			cwd: fixture.root,
			env: fixture.env,
			encoding: "utf8",
		});
		expect(result.status, result.stderr).toBe(0);
		expect(readOutput(fixture).mode).toBe("full");
	});

	it("fails planning before selection when its Git comparison is invalid", () => {
		const fixture = createFixture([]);
		const result = spawnSync(
			process.execPath,
			[selectorPath, "browser", "--plan-only"],
			{
				cwd: fixture.root,
				env: { ...fixture.env, TEST_BASE_REF: "missing-fixture-ref" },
				encoding: "utf8",
			},
		);
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain("missing-fixture-ref");
	});

	it("retains the six isolated jobs, existing worker counts and deadlines", () => {
		const matrix = workflow.jobs.browser.strategy.matrix.include;
		expect(matrix.map(({ label }) => label)).toEqual([
			"desktop-chromium-1-of-2",
			"desktop-chromium-2-of-2",
			"desktop-firefox",
			"desktop-webkit",
			"mobile-chromium",
			"mobile-webkit",
		]);
		expect(workflow.jobs.browser.env.PLAYWRIGHT_WORKERS).toBe(2);
		expect(workflow.jobs["browser-affected"].env.PLAYWRIGHT_WORKERS).toBe(1);
		expect(workflow.jobs.browser["timeout-minutes"]).toBe(35);
		expect(workflow.jobs["browser-affected"]["timeout-minutes"]).toBe(20);
		expect(workflow.jobs.browser.needs).toContain("preflight");
		expect(workflow.jobs["browser-affected"].needs).toContain("preflight");
		expect(workflow.jobs.browser.if).toContain("mode == 'full'");
		expect(workflow.jobs["browser-affected"].if).toContain("mode == 'feature'");
	});

	it.each([
		["full", "success", "success", "skipped", 0],
		["full", "success", "failure", "skipped", 1],
		["full", "success", "cancelled", "skipped", 1],
		["full", "success", "skipped", "success", 1],
		["full", "failure", "success", "skipped", 1],
		["feature", "success", "skipped", "success", 0],
		["feature", "success", "skipped", "failure", 1],
		["feature", "success", "skipped", "cancelled", 1],
		["feature", "success", "success", "skipped", 1],
		["unknown", "success", "success", "success", 1],
	])(
		"enforces the real final gate for %s/%s/%s/%s",
		(mode, preflight, browser, affected, status) => {
			const result = spawnSync("bash", ["-e", "-c", gateShell], {
				env: {
					PATH: process.env.PATH,
					MODE: mode,
					PLAN_RESULT: "success",
					SOURCE_RESULT: "success",
					PREFLIGHT_RESULT: preflight,
					BROWSER_RESULT: browser,
					AFFECTED_RESULT: affected,
				},
				encoding: "utf8",
			});
			expect(result.status).toBe(status);
		},
	);
});
