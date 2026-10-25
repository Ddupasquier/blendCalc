/**
 * Purpose: Validate complete npm audit evidence and require clean production and
 * development dependency trees. Do not run directly; maintained audit commands
 * import this policy. There are no active vulnerability exceptions.
 */

import { createHash } from "node:crypto";

const canonicalize = (value) =>
	Array.isArray(value)
		? value.map(canonicalize)
		: value && typeof value === "object"
			? Object.fromEntries(
					Object.keys(value)
						.sort()
						.map((key) => [key, canonicalize(value[key])]),
				)
			: value;

export const auditRecordDigest = (value) =>
	createHash("sha256")
		.update(JSON.stringify(canonicalize(value)))
		.digest("hex");

export const parseAuditResult = (result) => {
	if (result.error || result.signal || ![0, 1].includes(result.status))
		throw new Error(
			"npm audit did not complete successfully (execution, network or registry error).",
		);
	let report;
	try {
		report = JSON.parse(result.stdout);
	} catch {
		throw new Error("npm audit returned invalid JSON.");
	}
	if (
		report?.error ||
		report?.auditReportVersion !== 2 ||
		!report.vulnerabilities ||
		typeof report.vulnerabilities !== "object" ||
		Array.isArray(report.vulnerabilities)
	)
		throw new Error("npm audit returned an error or unsupported report.");
	const counts = report.metadata?.vulnerabilities;
	const entries = Object.entries(report.vulnerabilities);
	if (
		!counts ||
		!["info", "low", "moderate", "high", "critical", "total"].every(
			(key) => Number.isSafeInteger(counts[key]) && counts[key] >= 0,
		) ||
		counts.total !== entries.length
	)
		throw new Error("npm audit returned incomplete vulnerability counts.");
	if (
		["info", "low", "moderate", "high", "critical"].reduce(
			(total, key) => total + counts[key],
			0,
		) !== counts.total
	)
		throw new Error("npm audit returned inconsistent vulnerability counts.");
	for (const severity of ["info", "low", "moderate", "high", "critical"]) {
		if (
			counts[severity] !==
			entries.filter(([, finding]) => finding?.severity === severity).length
		)
			throw new Error("npm audit returned inconsistent vulnerability counts.");
	}
	for (const [name, finding] of entries) {
		if (
			finding?.name !== name ||
			typeof finding.isDirect !== "boolean" ||
			!Array.isArray(finding.via) ||
			!finding.via.length ||
			!Array.isArray(finding.nodes) ||
			!finding.nodes.length
		)
			throw new Error("npm audit returned incomplete finding evidence.");
	}
	const blocking = counts.moderate + counts.high + counts.critical;
	if (result.status !== (blocking > 0 ? 1 : 0))
		throw new Error("npm audit exit status contradicts its findings.");
	return report;
};

export const evaluateDependencyAudits = ({ full, production }) => {
	const fullReport = parseAuditResult(full);
	const productionReport = parseAuditResult(production);
	if (productionReport.metadata.vulnerabilities.total !== 0)
		throw new Error(
			"Production dependencies have vulnerability findings; no production exception exists.",
		);
	if (fullReport.metadata.vulnerabilities.total !== 0)
		throw new Error(
			"Development dependencies have vulnerability findings; no active exception exists.",
		);
	return { accepted: false, fullReport, productionReport };
};
