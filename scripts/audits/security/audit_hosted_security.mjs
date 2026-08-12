/**
 * Purpose: Read the linked Supabase project's hosted network, backup, and Auth
 * controls without changing them or printing secrets and report launch blockers.
 * Run: `node scripts/audits/security/audit_hosted_security.mjs`
 * Strict: `node scripts/audits/security/audit_hosted_security.mjs --strict`
 * JSON: `node scripts/audits/security/audit_hosted_security.mjs --json`
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	evaluateHostedSecuritySnapshot,
	getSerializableHostedSecuritySnapshot,
} from "../../lib/security/hosted_security_audit.mjs";

const argumentsSet = new Set(process.argv.slice(2));
const shouldPrintJson = argumentsSet.has("--json");
const shouldFailOnBlockers = argumentsSet.has("--strict");

const readProjectReference = () => {
	const environmentReference = process.env.SUPABASE_PROJECT_ID?.trim();
	if (environmentReference) return environmentReference;

	try {
		return readFileSync(
			resolve("supabase/.temp/project-ref"),
			"utf8",
		).trim();
	} catch {
		throw new Error(
			"The linked Supabase project reference is unavailable. Run `npm run db:link` or set SUPABASE_PROJECT_ID.",
		);
	}
};

const readSupabaseAccessToken = () => {
	const environmentToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
	if (environmentToken) return environmentToken;

	if (process.platform !== "darwin") {
		throw new Error(
			"SUPABASE_ACCESS_TOKEN is required outside macOS. Keep it in the environment, never in the repository.",
		);
	}

	try {
		return execFileSync(
			"security",
			["find-generic-password", "-s", "Supabase CLI", "-w"],
			{
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
			},
		).trim();
	} catch {
		throw new Error(
			"Supabase access is unavailable from the environment or macOS Keychain. Sign in with the Supabase CLI first.",
		);
	}
};

const runSupabaseJsonCommand = (commandArguments) => {
	const output = execFileSync(
		"supabase",
		[...commandArguments, "--output", "json"],
		{
			encoding: "utf8",
			maxBuffer: 16 * 1024 * 1024,
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	return JSON.parse(output);
};

const readHostedAuthConfiguration = async (projectReference, accessToken) => {
	const response = await fetch(
		`https://api.supabase.com/v1/projects/${projectReference}/config/auth`,
		{
			headers: { Authorization: `Bearer ${accessToken}` },
		},
	);
	if (!response.ok) {
		throw new Error(
			`Unable to read hosted Auth configuration (HTTP ${response.status}).`,
		);
	}
	return response.json();
};

const projectReference = readProjectReference();
const accessToken = readSupabaseAccessToken();
const projects = runSupabaseJsonCommand(["projects", "list"]);
const project = projects.find(({ id }) => id === projectReference);
if (!project) {
	throw new Error("The linked Supabase project was not found in this account.");
}

const [networkRestrictions, backupConfiguration, authConfiguration] =
	await Promise.all([
		Promise.resolve(
			runSupabaseJsonCommand([
				"network-restrictions",
				"get",
				"--project-ref",
				projectReference,
				"--experimental",
			]),
		),
		Promise.resolve(
			runSupabaseJsonCommand([
				"backups",
				"list",
				"--project-ref",
				projectReference,
				"--experimental",
			]),
		),
		readHostedAuthConfiguration(projectReference, accessToken),
	]);

const snapshot = {
	project,
	networkRestrictions,
	backupConfiguration,
	authConfiguration,
};
const report = evaluateHostedSecuritySnapshot(snapshot);

if (shouldPrintJson) {
	console.log(
		JSON.stringify(
			{
				checkedAt: new Date().toISOString(),
				snapshot: getSerializableHostedSecuritySnapshot(snapshot),
				...report,
			},
			null,
			2,
		),
	);
} else {
	const statusLabels = {
		pass: "PASS",
		fail: "FAIL",
		blocked: "BLOCKED",
		info: "INFO",
	};
	for (const finding of report.findings) {
		console.log(
			`${statusLabels[finding.status]}  ${finding.label}: ${finding.detail}`,
		);
	}
	console.log(
		`\nSummary: ${report.summary.pass} passed, ${report.summary.fail} failed, ${report.summary.blocked} blocked, ${report.summary.info} informational.`,
	);
}

if (
	shouldFailOnBlockers &&
	(report.summary.fail > 0 || report.summary.blocked > 0)
) {
	process.exitCode = 1;
}
