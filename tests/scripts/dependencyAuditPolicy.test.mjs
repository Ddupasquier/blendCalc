import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { load } from "js-yaml";
import { describe, expect, it, vi } from "vitest";
import {
	evaluateDependencyAudits,
	parseAuditResult,
} from "../../scripts/lib/security/dependency_audit_policy.mjs";
import { runDependencyAudit } from "../../scripts/lib/security/run_dependency_audit.mjs";

const repositoryRoot = resolve(".");
const report = (severity) => ({
	status: ["moderate", "high", "critical"].includes(severity) ? 1 : 0,
	stdout: JSON.stringify({
		auditReportVersion: 2,
		vulnerabilities: severity
			? {
					example: {
						name: "example",
						severity,
						isDirect: false,
						via: ["advisory"],
						effects: [],
						nodes: ["node_modules/example"],
					},
				}
			: {},
		metadata: {
			vulnerabilities: Object.fromEntries(
				["info", "low", "moderate", "high", "critical", "total"].map((name) => [
					name,
					severity && (name === severity || name === "total") ? 1 : 0,
				]),
			),
		},
	}),
});
const clean = report();

describe("clean dependency audit policy", () => {
	it("accepts clean full and production evidence", () => {
		expect(
			evaluateDependencyAudits({ full: clean, production: clean }).accepted,
		).toBe(false);
	});
	it.each(["info", "low", "moderate", "high", "critical"])(
		"refuses %s findings in either tree",
		(severity) => {
			expect(() =>
				evaluateDependencyAudits({ full: report(severity), production: clean }),
			).toThrow("Development dependencies");
			expect(() =>
				evaluateDependencyAudits({ full: clean, production: report(severity) }),
			).toThrow("Production dependencies");
		},
	);
	it.each([
		{ status: 2, stdout: "{}" },
		{ status: null, signal: "SIGTERM", stdout: "" },
		{ status: 1, stdout: "invalid" },
		{ status: 1, stdout: JSON.stringify({ error: { code: "ENETWORK" } }) },
		{ ...clean, error: new Error("timeout") },
		{ ...report("high"), status: 0 },
		{ status: 0, stdout: "{}" },
	])("refuses failed or incomplete execution %#", (result) => {
		expect(() => parseAuditResult(result)).toThrow();
	});
	it("refuses inconsistent counts and incomplete findings", () => {
		const value = JSON.parse(report("high").stdout);
		value.metadata.vulnerabilities.total = 0;
		expect(() =>
			parseAuditResult({ status: 1, stdout: JSON.stringify(value) }),
		).toThrow("counts");
		value.metadata.vulnerabilities.total = 1;
		delete value.vulnerabilities.example.nodes;
		expect(() =>
			parseAuditResult({ status: 1, stdout: JSON.stringify(value) }),
		).toThrow("evidence");
	});
	it("runs bounded scripts-disabled audits and prints both reports", async () => {
		const run = vi.fn(() => clean);
		const log = vi.fn();
		await runDependencyAudit({ repositoryRoot, run, log });
		expect(run).toHaveBeenCalledTimes(2);
		for (const [command, args, options] of run.mock.calls) {
			expect(command).toBe("npm");
			expect(args).toContain("--ignore-scripts");
			expect(args).toContain("--package-lock-only");
			expect(options.timeout).toBe(30000);
		}
		expect(run.mock.calls[1][1]).toContain("--omit=dev");
		expect(log).toHaveBeenCalledWith(
			"FULL DEPENDENCY AUDIT (findings are not suppressed)",
		);
		expect(log).toHaveBeenCalledWith("PRODUCTION DEPENDENCY AUDIT");
	});
	it("does not disclose subprocess stderr on execution failure", async () => {
		const log = vi.fn();
		await expect(
			runDependencyAudit({
				repositoryRoot,
				log,
				run: () => ({
					status: 2,
					stdout: "{}",
					stderr: "private diagnostic canary",
				}),
			}),
		).rejects.toThrow("npm audit");
		expect(JSON.stringify(log.mock.calls)).not.toContain(
			"private diagnostic canary",
		);
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
