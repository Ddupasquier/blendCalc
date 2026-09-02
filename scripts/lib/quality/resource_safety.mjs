import { execFileSync } from "node:child_process";
import { basename } from "node:path";

export const gibibyte = 1024 ** 3;

export const resourceSafetyThresholds = Object.freeze({
	minimumStartupDiskFreeBytes: 50 * gibibyte,
	maximumSwapUsedBytes: 8 * gibibyte,
	maximumProcessResidentBytes: 4 * gibibyte,
});

const sizeMultipliers = {
	B: 1,
	K: 1024,
	M: 1024 ** 2,
	G: gibibyte,
	T: 1024 ** 4,
};

export const parseSizedBytes = (value) => {
	const match = String(value)
		.trim()
		.match(/^(\d+(?:\.\d+)?)\s*([BKMGT])(?:i?B)?$/i);
	if (!match) return null;
	return Number(match[1]) * sizeMultipliers[match[2].toUpperCase()];
};

export const parseAvailableDiskBytes = (output) => {
	const rows = output.trim().split("\n").filter(Boolean);
	const columns = rows.at(-1)?.trim().split(/\s+/) ?? [];
	const availableKilobytes = Number(columns[3]);
	return Number.isFinite(availableKilobytes) ? availableKilobytes * 1024 : null;
};

export const parseMacOsSwapUsedBytes = (output) => {
	const match = output.match(/used\s*=\s*(\d+(?:\.\d+)?)([BKMGT])/i);
	return match ? parseSizedBytes(`${match[1]}${match[2]}`) : null;
};

export const parseRelevantProcesses = (output, excludedPids = []) => {
	const excluded = new Set(excludedPids.map(Number));
	return output
		.trim()
		.split("\n")
		.map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/))
		.filter(Boolean)
		.map((match) => ({
			residentBytes: Number(match[1]) * 1024,
			pid: Number(match[2]),
			command: match[3],
		}))
		.filter(
			({ pid, residentBytes }) =>
				!excluded.has(pid) && residentBytes >= gibibyte,
		);
};

export const evaluateResourceSafety = (
	snapshot,
	thresholds = resourceSafetyThresholds,
) => {
	const issues = [];
	if (
		snapshot.startupDiskFreeBytes !== null &&
		snapshot.startupDiskFreeBytes < thresholds.minimumStartupDiskFreeBytes
	) {
		issues.push({
			kind: "startup-disk",
			actualBytes: snapshot.startupDiskFreeBytes,
			limitBytes: thresholds.minimumStartupDiskFreeBytes,
		});
	}
	if (
		snapshot.swapUsedBytes !== null &&
		snapshot.swapUsedBytes > thresholds.maximumSwapUsedBytes
	) {
		issues.push({
			kind: "swap",
			actualBytes: snapshot.swapUsedBytes,
			limitBytes: thresholds.maximumSwapUsedBytes,
		});
	}
	for (const process of snapshot.processes) {
		if (process.residentBytes <= thresholds.maximumProcessResidentBytes) {
			continue;
		}
		issues.push({
			kind: "process",
			actualBytes: process.residentBytes,
			limitBytes: thresholds.maximumProcessResidentBytes,
			process,
		});
	}
	return issues;
};

export const inspectLocalResources = ({
	platform = process.platform,
	execute = execFileSync,
	excludedPids = [process.pid],
} = {}) => {
	const startupDiskFreeBytes = parseAvailableDiskBytes(
		execute("df", ["-Pk", "/"], { encoding: "utf8" }),
	);
	const swapUsedBytes =
		platform === "darwin"
			? parseMacOsSwapUsedBytes(
					execute("sysctl", ["-n", "vm.swapusage"], {
						encoding: "utf8",
					}),
				)
			: null;
	const processes = parseRelevantProcesses(
		execute("ps", ["-axo", "rss=,pid=,comm="], { encoding: "utf8" }),
		excludedPids,
	);
	return { startupDiskFreeBytes, swapUsedBytes, processes };
};

export const formatGibibytes = (bytes) =>
	`${(bytes / gibibyte).toFixed(1)} GiB`;

export const formatResourceIssue = (issue) => {
	switch (issue.kind) {
		case "startup-disk":
			return `Startup disk has ${formatGibibytes(issue.actualBytes)} free; at least ${formatGibibytes(issue.limitBytes)} is required.`;
		case "swap":
			return `Swap use is ${formatGibibytes(issue.actualBytes)}; it must be at or below ${formatGibibytes(issue.limitBytes)}.`;
		case "process":
			return `${basename(issue.process.command)} PID ${issue.process.pid} is using ${formatGibibytes(issue.actualBytes)}; the development-process limit is ${formatGibibytes(issue.limitBytes)}.`;
		default:
			return "Unknown resource-safety issue.";
	}
};

export const assertLocalResourceSafety = ({
	environment = process.env,
	snapshot = null,
} = {}) => {
	if (environment.CI) {
		return { skipped: true, overridden: false, snapshot: null, issues: [] };
	}
	const currentSnapshot = snapshot ?? inspectLocalResources();
	const issues = evaluateResourceSafety(currentSnapshot);
	const overridden = environment.BLENDCALC_ALLOW_RESOURCE_PRESSURE === "1";
	if (issues.length > 0 && !overridden) {
		throw new Error(
			[
				"Resource safety check failed:",
				...issues.map((issue) => `- ${formatResourceIssue(issue)}`),
				"Resolve the pressure before a heavy run. Use BLENDCALC_ALLOW_RESOURCE_PRESSURE=1 only for a deliberate one-time override.",
			].join("\n"),
		);
	}
	return {
		skipped: false,
		overridden,
		snapshot: currentSnapshot,
		issues,
	};
};
