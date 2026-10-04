import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { load } from "js-yaml";
import { describe, expect, it, vi } from "vitest";
import {
	assertExceptionWindow,
	assertReviewedLock,
	assertUnpatchedAdvisory,
	auditRecordDigest,
	dependencyAuditException,
	evaluateDependencyAudits,
	parseAuditResult,
} from "../../scripts/lib/security/dependency_audit_policy.mjs";
import { runDependencyAudit } from "../../scripts/lib/security/run_dependency_audit.mjs";

const repositoryRoot = resolve(".");
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const now = new Date("2026-10-05T12:00:00Z");
const advisory = {
	source: 1240992,
	name: "braces",
	dependency: "braces",
	title:
		"braces vulnerable to stack-exhaustion denial of service through deeply nested patterns",
	url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
	severity: "high",
	cwe: ["CWE-674"],
	cvss: {
		score: 7.5,
		vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H",
	},
	range: "<=3.0.3",
};

// Recorded public npm report, independent of the policy's digest.
const reviewedFindings = Object.fromEntries(
	[
		["braces", [advisory], ["micromatch"], "*", false, false],
		["fast-glob", ["micromatch"], ["globby", "stylelint"], "*", false, false],
		["globby", ["fast-glob", "micromatch"], [], ">=8.0.0", false, true],
		[
			"micromatch",
			["braces"],
			["fast-glob", "globby", "stylelint"],
			">=0.2.0",
			false,
			false,
		],
		[
			"stylelint",
			["fast-glob", "micromatch"],
			[
				"stylelint-config-recommended",
				"stylelint-config-recommended-scss",
				"stylelint-scss",
			],
			">=7.7.1",
			true,
			false,
		],
		[
			"stylelint-config-recommended",
			["stylelint"],
			["stylelint-config-recommended-scss"],
			"*",
			false,
			false,
		],
		[
			"stylelint-config-recommended-scss",
			["stylelint", "stylelint-config-recommended", "stylelint-scss"],
			[],
			"*",
			true,
			false,
		],
		[
			"stylelint-scss",
			["stylelint"],
			["stylelint-config-recommended-scss"],
			">=2.0.0",
			false,
			false,
		],
	].map(([name, via, effects, range, isDirect, fixAvailable]) => [
		name,
		{
			name,
			severity: "high",
			isDirect,
			via,
			effects,
			range,
			nodes: [`node_modules/${name}`],
			fixAvailable,
		},
	]),
);

const makeResult = (vulnerabilities) => {
	const counts = {
		info: 0,
		low: 0,
		moderate: 0,
		high: 0,
		critical: 0,
		total: Object.keys(vulnerabilities).length,
	};
	for (const finding of Object.values(vulnerabilities))
		counts[finding.severity] += 1;
	return {
		status: counts.moderate + counts.high + counts.critical > 0 ? 1 : 0,
		stdout: JSON.stringify({
			auditReportVersion: 2,
			vulnerabilities,
			metadata: { vulnerabilities: counts },
		}),
	};
};
const full = makeResult(reviewedFindings);
const production = makeResult({});
const evaluate = (overrides = {}) =>
	evaluateDependencyAudits({ full, production, lock, now, ...overrides });
const upstream = {
	ghsa_id: "GHSA-vfj7-8cjw-p6xm",
	severity: "high",
	withdrawn_at: null,
	vulnerabilities: [
		{
			package: { ecosystem: "npm", name: "braces" },
			vulnerable_version_range: "<= 3.0.3",
			first_patched_version: null,
			vulnerable_functions: [],
		},
	],
	cwes: [{ cwe_id: "CWE-674", name: "Uncontrolled Recursion" }],
	cvss: { score: 7.5, vector_string: advisory.cvss.vectorString },
};
const respond = (value = upstream) => ({
	ok: true,
	text: async () => JSON.stringify(value),
});

describe("bounded dependency audit exception", () => {
	it("accepts exactly the recorded eight development findings without removing them", () => {
		expect(auditRecordDigest(reviewedFindings)).toBe(
			dependencyAuditException.findingsSha256,
		);
		const result = evaluate();
		expect(result.accepted).toBe(true);
		expect(result.fullReport.metadata.vulnerabilities.high).toBe(8);
		expect(result.productionReport.metadata.vulnerabilities.total).toBe(0);
	});
	it("records an absolute seven-day window with no automatic renewal", () => {
		expect(dependencyAuditException.approvedAt).toBe("2026-10-04T22:29:58Z");
		expect(dependencyAuditException.expiresAt).toBe("2026-10-11T22:29:58Z");
		expect(() =>
			assertExceptionWindow(new Date("2026-10-11T22:29:57.999Z")),
		).not.toThrow();
		for (const value of ["2026-10-11T22:29:58Z", "2026-10-12T00:00:00Z"])
			expect(() => evaluate({ now: new Date(value) })).toThrow("expired");
		for (const value of ["invalid", "2026-10-04T22:29:57Z"])
			expect(() => assertExceptionWindow(new Date(value))).toThrow("clock");
	});
	it("allows a genuinely clean audit without using an expired exception", () => {
		expect(
			evaluate({ full: production, now: new Date("2026-10-20T00:00:00Z") })
				.accepted,
		).toBe(false);
	});
	it.each(["low", "moderate", "high", "critical"])(
		"rejects an unrelated %s advisory",
		(severity) => {
			const findings = structuredClone(reviewedFindings);
			findings.unreviewed = {
				...structuredClone(findings.braces),
				name: "unreviewed",
				severity,
			};
			expect(() => evaluate({ full: makeResult(findings) })).toThrow("differ");
		},
	);
	it.each([
		[
			"another advisory",
			(f) => {
				f.braces.via[0].url = "https://github.com/advisories/GHSA-other";
			},
		],
		[
			"changed severity",
			(f) => {
				f.braces.severity = "critical";
			},
		],
		[
			"changed affected range",
			(f) => {
				f.braces.via[0].range = "*";
			},
		],
		[
			"changed CVSS",
			(f) => {
				f.braces.via[0].cvss.score = 9;
			},
		],
		[
			"additional cause",
			(f) => {
				f.stylelint.via.push(structuredClone(advisory));
			},
		],
		[
			"new nested path",
			(f) => {
				f.braces.nodes.push("node_modules/other/node_modules/braces");
			},
		],
		[
			"available root fix",
			(f) => {
				f.braces.fixAvailable = true;
			},
		],
		[
			"available Stylelint fix",
			(f) => {
				f.stylelint.fixAvailable = true;
			},
		],
		[
			"removed finding",
			(f) => {
				delete f.globby;
			},
		],
	])("rejects %s rather than broadening the exception", (_, mutate) => {
		const findings = structuredClone(reviewedFindings);
		mutate(findings);
		expect(() => evaluate({ full: makeResult(findings) })).toThrow("differ");
	});
	it.each(["version", "integrity", "resolved", "dependencies", "dev"])(
		"rejects locked %s drift",
		(field) => {
			const changed = structuredClone(lock);
			changed.packages["node_modules/braces"][field] =
				field === "dev" ? false : "changed";
			expect(() => evaluate({ lock: changed })).toThrow("drift");
		},
	);
	it("rejects duplicate locked paths even when the audit omits them", () => {
		const changed = structuredClone(lock);
		changed.packages["node_modules/other/node_modules/braces"] =
			structuredClone(changed.packages["node_modules/braces"]);
		expect(() => assertReviewedLock(changed)).toThrow("duplicate");
	});
	it("rejects a missing reviewed path and unsupported lockfile", () => {
		const changed = structuredClone(lock);
		delete changed.packages["node_modules/stylelint"];
		expect(() => assertReviewedLock(changed)).toThrow("drift");
		expect(() => assertReviewedLock({ lockfileVersion: 2 })).toThrow(
			"lockfile",
		);
	});
	it("rejects any production finding, including the otherwise accepted advisory", () => {
		expect(() => evaluate({ production: full })).toThrow("Production");
	});
	it.each([
		{ status: 2, stdout: "{}" },
		{ status: null, stdout: "", signal: "SIGTERM" },
		{ status: 1, stdout: "invalid" },
		{ status: 1, stdout: JSON.stringify({ error: { code: "ENETWORK" } }) },
		{ ...full, error: new Error("timeout") },
		{ ...full, status: 0 },
		{ status: 0, stdout: "{}" },
	])("fails closed on incomplete or failed execution %#", (result) => {
		expect(() => parseAuditResult(result)).toThrow();
	});
	it("rejects inconsistent counts and missing finding evidence", () => {
		const report = JSON.parse(full.stdout);
		report.metadata.vulnerabilities.total = 0;
		expect(() =>
			parseAuditResult({ ...full, stdout: JSON.stringify(report) }),
		).toThrow("counts");
		report.metadata.vulnerabilities.total = 8;
		report.metadata.vulnerabilities.high = 7;
		expect(() =>
			parseAuditResult({ ...full, stdout: JSON.stringify(report) }),
		).toThrow("counts");
		expect(() =>
			parseAuditResult(makeResult({ bad: { name: "bad", severity: "high" } })),
		).toThrow("evidence");
	});
	it.each([
		[
			"patch",
			(a) => {
				a.vulnerabilities[0].first_patched_version = "3.0.4";
			},
		],
		[
			"withdrawal",
			(a) => {
				a.withdrawn_at = "2026-10-06T00:00:00Z";
			},
		],
		[
			"severity",
			(a) => {
				a.severity = "critical";
			},
		],
		[
			"range",
			(a) => {
				a.vulnerabilities[0].vulnerable_version_range = "*";
			},
		],
		[
			"package",
			(a) => {
				a.vulnerabilities[0].package.name = "other";
			},
		],
	])("requires new review when upstream reports %s", (_, mutate) => {
		const changed = structuredClone(upstream);
		mutate(changed);
		expect(() => assertUnpatchedAdvisory(changed)).toThrow("Upstream");
	});
});

describe("audit execution and delivery wiring", () => {
	it.each([
		["reuse", "success", "skipped", "skipped", 0],
		["reuse", "failure", "skipped", "skipped", 1],
		["reuse", "skipped", "skipped", "skipped", 1],
		["full", "success", "success", "skipped", 0],
		["full", "failure", "success", "skipped", 1],
		["feature", "success", "skipped", "success", 0],
		["feature", "failure", "skipped", "success", 1],
	])(
		"enforces the actual final CI gate for %s/%s",
		(mode, preflight, browser, affected, expected) => {
			const workflow = load(
				readFileSync(".github/workflows/verify.yml", "utf8"),
			);
			const gate = workflow.jobs["browser-gate"].steps[0].run;
			const result = spawnSync("bash", ["-e", "-c", gate], {
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
			expect(result.status).toBe(expected);
		},
	);
	const runner = (options = {}) =>
		runDependencyAudit({
			repositoryRoot,
			run: vi.fn((_, args) =>
				args.includes("--omit=dev") ? production : full,
			),
			fetchAdvisory: vi.fn(async () => respond()),
			log: vi.fn(),
			clock: () => now,
			...options,
		});
	it("uses bounded scripts-disabled audits, keeps evidence visible and checks upstream", async () => {
		const run = vi.fn((_, args) =>
			args.includes("--omit=dev") ? production : full,
		);
		const log = vi.fn();
		const fetchAdvisory = vi.fn(async () => respond());
		expect((await runner({ run, log, fetchAdvisory })).accepted).toBe(true);
		expect(run).toHaveBeenCalledTimes(2);
		for (const [command, args, options] of run.mock.calls) {
			expect(command).toBe("npm");
			expect(args).toEqual(
				expect.arrayContaining([
					"--package-lock-only",
					"--ignore-scripts",
					"--audit-level=moderate",
					"--json",
				]),
			);
			expect(options.timeout).toBe(30_000);
		}
		expect(fetchAdvisory).toHaveBeenCalledWith(
			"https://api.github.com/advisories/GHSA-vfj7-8cjw-p6xm",
			expect.any(Object),
		);
		expect(log.mock.calls.map(([value]) => value).join("\n")).toContain(
			'"high": 8',
		);
		expect(log.mock.calls.at(-1)[0]).toContain("vulnerability remains unfixed");
	});
	it.each([
		async () => {
			throw new Error("network canary secret");
		},
		async () => ({ ok: false }),
		async () => ({ ok: true, text: async () => "invalid" }),
		async () => ({ ok: true, text: async () => "x".repeat(1024 * 1024 + 1) }),
	])(
		"refuses upstream network/parse/status/size failures without leaking details %#",
		async (fetchAdvisory) => {
			await expect(runner({ fetchAdvisory })).rejects.toThrow(
				"without current evidence",
			);
		},
	);
	it("refuses a patch and rechecks expiry after network work", async () => {
		const patched = structuredClone(upstream);
		patched.vulnerabilities[0].first_patched_version = "3.0.4";
		await expect(
			runner({ fetchAdvisory: async () => respond(patched) }),
		).rejects.toThrow("patch");
		const clock = vi
			.fn()
			.mockReturnValueOnce(now)
			.mockReturnValue(new Date(dependencyAuditException.expiresAt));
		await expect(runner({ clock })).rejects.toThrow("expired");
	});
	it("prints refused valid findings and never logs npm error text", async () => {
		const findings = structuredClone(reviewedFindings);
		findings.braces.via[0].range = "changed";
		const log = vi.fn();
		await expect(
			runner({
				run: (_, args) =>
					args.includes("--omit=dev") ? production : makeResult(findings),
				log,
			}),
		).rejects.toThrow("differ");
		expect(log.mock.calls.map(([value]) => value).join("\n")).toContain(
			'"range": "changed"',
		);
		log.mockClear();
		await expect(
			runner({
				run: () => ({
					status: 2,
					stdout: "secret canary",
					stderr: "secret canary",
				}),
				log,
			}),
		).rejects.toThrow("npm audit");
		expect(JSON.stringify(log.mock.calls)).not.toContain("secret canary");
	});
	it("does not call the upstream exception check for clean evidence", async () => {
		const fetchAdvisory = vi.fn();
		expect(
			(await runner({ run: () => production, fetchAdvisory })).accepted,
		).toBe(false);
		expect(fetchAdvisory).not.toHaveBeenCalled();
	});
	it("uses the same gate in scheduled CI, full CI, release/nightly and promotion reuse", () => {
		const command = "scripts/operations/quality/audit_dependencies.mjs";
		const workflow = readFileSync(".github/workflows/verify.yml", "utf8");
		expect(workflow).toContain(`run: node ${command}`);
		expect(workflow).toContain('"$mode" == "full" || "$mode" == "reuse"');
		expect(workflow).toContain("tests/scripts/dependencyAuditPolicy.test.mjs");
		expect(
			workflow.slice(
				workflow.indexOf("  preflight:"),
				workflow.indexOf("  source:"),
			),
		).not.toContain("mode != 'reuse'");
		expect(
			readFileSync(".github/workflows/dependency-audit.yml", "utf8"),
		).toContain(`run: node ${command}`);
		const dashboard = readFileSync(
			"scripts/operations/quality/run_verification_dashboard.mjs",
			"utf8",
		);
		expect(dashboard.split(command)).toHaveLength(3);
		expect(dashboard).toContain(
			'verificationStage.id === "dependencies" || result.exitCode !== 0',
		);
		expect(dashboard).toContain("Full dependency audit evidence:");
		expect(dashboard).toContain("console.log(evidence.outcome)");
		const promotion = readFileSync(
			"scripts/operations/quality/verify_release_promotion.mjs",
			"utf8",
		);
		expect(
			promotion.split("await runDependencyAudit({ repositoryRoot })"),
		).toHaveLength(3);
		expect(
			promotion.indexOf("await runDependencyAudit({ repositoryRoot })"),
		).toBeLessThan(promotion.indexOf("Promotion integrity passed:"));
		expect(
			promotion.lastIndexOf("await runDependencyAudit({ repositoryRoot })"),
		).toBeLessThan(promotion.indexOf("Promotion Check passed:"));
	});
	it("preserves all active style rules and SCSS checks", async () => {
		const { default: stylelint } = await import("stylelint");
		const config = await stylelint.resolveConfig("src/styles/main.scss");
		const rules = Object.entries(config.rules).filter(
			([, value]) =>
				value !== null && (!Array.isArray(value) || value[0] !== null),
		);
		expect(rules).toHaveLength(47);
		expect(rules.filter(([name]) => name.startsWith("scss/"))).toHaveLength(13);
	}, 15_000);
});
