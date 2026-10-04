/**
 * Purpose: Evaluate complete npm audit evidence against the single reviewed,
 * time-limited development-tool exception. Do not run directly; audit and promotion
 * commands own execution. No environment variable or CLI flag changes the deadline.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const dependencyAuditException = JSON.parse(
	readFileSync(
		new URL("../../../config/dependencyAuditException.json", import.meta.url),
		"utf8",
	),
);

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

export const assertExceptionWindow = (now = new Date()) => {
	const approved = Date.parse(dependencyAuditException.approvedAt);
	const expires = Date.parse(dependencyAuditException.expiresAt);
	if (
		!Number.isFinite(now.getTime()) ||
		expires - approved !== 7 * 24 * 60 * 60 * 1000 ||
		now.getTime() < approved
	) {
		throw new Error("Invalid exception approval window or audit clock.");
	}
	if (now.getTime() >= expires) {
		throw new Error(
			`Dependency exception expired at ${dependencyAuditException.expiresAt}; renewal is not automatic.`,
		);
	}
};

export const assertReviewedLock = (lock) => {
	if (lock?.lockfileVersion !== 3 || !lock.packages)
		throw new Error("Unsupported dependency lockfile.");
	for (const [path, approved] of Object.entries(
		dependencyAuditException.packages,
	)) {
		const record = lock.packages[path];
		if (
			record?.dev !== true ||
			record?.version !== approved.version ||
			auditRecordDigest(record) !== approved.recordSha256
		) {
			throw new Error(`Reviewed development dependency drift: ${path}.`);
		}
		if (
			Object.keys(lock.packages).some(
				(candidate) => candidate !== path && candidate.endsWith(`/${path}`),
			)
		) {
			throw new Error(`Unreviewed duplicate dependency path: ${path}.`);
		}
	}
};

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

export const evaluateDependencyAudits = ({
	full,
	production,
	lock,
	now = new Date(),
}) => {
	const fullReport = parseAuditResult(full);
	const productionReport = parseAuditResult(production);
	if (productionReport.metadata.vulnerabilities.total !== 0)
		throw new Error(
			"Production dependencies have vulnerability findings; no production exception exists.",
		);
	if (fullReport.metadata.vulnerabilities.total === 0)
		return { accepted: false, fullReport, productionReport };
	assertExceptionWindow(now);
	assertReviewedLock(lock);
	if (
		auditRecordDigest(fullReport.vulnerabilities) !==
		dependencyAuditException.findingsSha256
	)
		throw new Error(
			"Audit findings differ from the exact reviewed advisory, paths or conditions.",
		);
	return { accepted: true, fullReport, productionReport };
};

export const assertUnpatchedAdvisory = (advisory) => {
	const vulnerabilities = advisory?.vulnerabilities;
	const entry = vulnerabilities?.[0];
	if (
		advisory?.ghsa_id !== dependencyAuditException.advisory ||
		advisory.severity !== "high" ||
		advisory.withdrawn_at !== null ||
		vulnerabilities?.length !== 1 ||
		entry?.package?.ecosystem !== "npm" ||
		entry.package.name !== "braces" ||
		entry.vulnerable_version_range !== "<= 3.0.3" ||
		entry.first_patched_version !== null ||
		entry.vulnerable_functions?.length !== 0 ||
		advisory.cwes?.length !== 1 ||
		advisory.cwes[0].cwe_id !== "CWE-674" ||
		advisory.cvss?.score !== 7.5 ||
		advisory.cvss.vector_string !==
			"CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
	) {
		throw new Error(
			"Upstream advisory changed or a patch is available. Remove/review the exception and install a supported compatible fix.",
		);
	}
};
