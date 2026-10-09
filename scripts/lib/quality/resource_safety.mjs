/**
 * Purpose: Provide shared parsing, inspection, and enforcement for local resource
 * safety boundaries.
 * Do not run directly; import this module from a maintained quality command.
 */

import { execFileSync } from "node:child_process";
import { basename } from "node:path";

export const gibibyte = 1024 ** 3;

export const resourceSafetyThresholds = Object.freeze({
	minimumStartupDiskFreeBytes: 50 * gibibyte,
	maximumSwapUsedBytes: 16 * gibibyte,
	maximumProcessResidentBytes: 5 * gibibyte,
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

export const parsePhysicalMemoryBytes = (output) => {
	const value = String(output).trim();
	if (!/^\d+$/.test(value)) return null;
	const bytes = Number(value);
	return Number.isSafeInteger(bytes) && bytes > 0 ? bytes : null;
};

// This sysctl exports dispatch notification flags, not XNU's internal 0–4 enum.
// https://github.com/apple-oss-distributions/xnu/blob/main/bsd/kern/kern_memorystatus_notify.c
const macOsPressureNames = Object.freeze({
	1: "normal",
	2: "warning",
	4: "critical",
});

export const parseMacOsMemoryPressure = (output) => {
	const value = String(output).trim();
	return Object.hasOwn(macOsPressureNames, value)
		? macOsPressureNames[value]
		: null;
};

export const getMaximumSwapUsedBytes = (
	snapshot,
	thresholds = resourceSafetyThresholds,
) =>
	Number.isSafeInteger(snapshot.physicalMemoryBytes) &&
	snapshot.physicalMemoryBytes > 0
		? Math.min(thresholds.maximumSwapUsedBytes, snapshot.physicalMemoryBytes)
		: thresholds.maximumSwapUsedBytes;

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
	if (snapshot.platform === "darwin") {
		if (
			!Number.isSafeInteger(snapshot.physicalMemoryBytes) ||
			snapshot.physicalMemoryBytes <= 0 ||
			!Number.isFinite(snapshot.swapUsedBytes) ||
			snapshot.swapUsedBytes < 0 ||
			!Object.values(macOsPressureNames).includes(snapshot.memoryPressure)
		) {
			issues.push({ kind: "memory-measurement" });
		} else if (snapshot.memoryPressure !== "normal") {
			issues.push({
				kind: "memory-pressure",
				pressure: snapshot.memoryPressure,
			});
		}
	}
	if (
		!Number.isFinite(snapshot.startupDiskFreeBytes) ||
		snapshot.startupDiskFreeBytes < 0
	) {
		issues.push({ kind: "disk-measurement" });
	} else if (
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
		snapshot.swapUsedBytes > getMaximumSwapUsedBytes(snapshot, thresholds)
	) {
		issues.push({
			kind: "swap",
			actualBytes: snapshot.swapUsedBytes,
			limitBytes: getMaximumSwapUsedBytes(snapshot, thresholds),
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
	const readMacOsMeasurement = (name, parse) => {
		try {
			return parse(
				execute("sysctl", ["-n", name], {
					encoding: "utf8",
					stdio: ["ignore", "pipe", "ignore"],
				}),
			);
		} catch {
			return null;
		}
	};
	const startupDiskFreeBytes = parseAvailableDiskBytes(
		execute("df", ["-Pk", "/"], { encoding: "utf8" }),
	);
	const swapUsedBytes =
		platform === "darwin"
			? readMacOsMeasurement("vm.swapusage", parseMacOsSwapUsedBytes)
			: null;
	const physicalMemoryBytes =
		platform === "darwin"
			? readMacOsMeasurement("hw.memsize", parsePhysicalMemoryBytes)
			: null;
	const memoryPressure =
		platform === "darwin"
			? readMacOsMeasurement(
					"kern.memorystatus_vm_pressure_level",
					parseMacOsMemoryPressure,
				)
			: null;
	const processes = parseRelevantProcesses(
		execute("ps", ["-axo", "rss=,pid=,comm="], { encoding: "utf8" }),
		excludedPids,
	);
	return {
		platform,
		startupDiskFreeBytes,
		swapUsedBytes,
		physicalMemoryBytes,
		memoryPressure,
		processes,
	};
};

export const formatGibibytes = (bytes) =>
	`${(bytes / gibibyte).toFixed(1)} GiB`;

export const formatResourceIssue = (issue) => {
	switch (issue.kind) {
		case "disk-measurement":
			return "Startup disk free space could not be measured. Resolve the measurement failure before starting heavy work.";
		case "memory-measurement":
			return "macOS physical RAM, swap or current memory pressure could not be measured. Resolve the measurement failure before starting heavy work.";
		case "memory-pressure":
			return `macOS reports ${issue.pressure} current memory pressure. Wait for normal pressure before starting heavy work.`;
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
	if ([true, "true", "1"].includes(environment.CI)) {
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
