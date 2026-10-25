/**
 * Purpose: Run bounded, scripts-disabled lockfile audits without concealing
 * vulnerability evidence. Do not run directly;
 * the maintained audit CLI and promotion command import this module.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	auditRecordDigest,
	evaluateDependencyAudits,
	parseAuditResult,
} from "./dependency_audit_policy.mjs";

const auditArguments = [
	"audit",
	"--json",
	"--package-lock-only",
	"--ignore-scripts",
	"--audit-level=moderate",
];

export const runDependencyAudit = async ({
	repositoryRoot,
	run = spawnSync,
	log = console.log,
}) => {
	if (Number(process.versions.node.split(".")[0]) !== 24)
		throw new Error("Dependency verification requires Node.js 24.");
	const manifest = JSON.parse(
		readFileSync(join(repositoryRoot, "package.json"), "utf8"),
	);
	const lock = JSON.parse(
		readFileSync(join(repositoryRoot, "package-lock.json"), "utf8"),
	);
	for (const field of [
		"dependencies",
		"devDependencies",
		"optionalDependencies",
	]) {
		if (
			auditRecordDigest(manifest[field] ?? {}) !==
			auditRecordDigest(lock.packages?.[""]?.[field] ?? {})
		)
			throw new Error("Manifest and locked dependency declarations differ.");
	}
	const options = {
		cwd: repositoryRoot,
		encoding: "utf8",
		timeout: 30_000,
		maxBuffer: 4 * 1024 * 1024,
		stdio: ["ignore", "pipe", "pipe"],
	};
	const full = run("npm", auditArguments, options);
	const production = run("npm", [...auditArguments, "--omit=dev"], options);
	// Print valid reports before policy evaluation, including refused findings.
	log("FULL DEPENDENCY AUDIT (findings are not suppressed)");
	log(JSON.stringify(parseAuditResult(full), null, 2));
	log("PRODUCTION DEPENDENCY AUDIT");
	log(JSON.stringify(parseAuditResult(production), null, 2));
	const result = evaluateDependencyAudits({
		full,
		production,
	});
	log("Dependency audit clean. No active vulnerability exceptions.");
	return result;
};
