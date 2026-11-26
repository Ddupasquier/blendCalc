/**
 * Purpose: Report local resource observations without blocking repository verification.
 * Run: `npm run resources:check`.
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	getLocalResourceReport,
	formatGibibytes,
	formatResourceIssue,
	getMaximumSwapUsedBytes,
} from "../../lib/quality/resource_safety.mjs";

export const main = () => {
	const result = getLocalResourceReport();
	if (result.skipped) {
		console.log("Resource report skipped in CI.");
		return;
	}
	if (!result.snapshot) {
		console.warn(
			"Local resource measurements are unavailable; verification is not blocked.",
		);
		return;
	}
	const summary = [
		...(result.snapshot.physicalMemoryBytes === null
			? []
			: [`RAM ${formatGibibytes(result.snapshot.physicalMemoryBytes)}`]),
		...(result.snapshot.memoryPressure === null
			? []
			: [`current memory pressure ${result.snapshot.memoryPressure}`]),
		result.snapshot.startupDiskFreeBytes === null
			? "startup disk unavailable"
			: `startup disk ${formatGibibytes(result.snapshot.startupDiskFreeBytes)} free`,
		result.snapshot.swapUsedBytes === null
			? "swap unavailable"
			: `swap ${formatGibibytes(result.snapshot.swapUsedBytes)} used (advisory threshold ${formatGibibytes(getMaximumSwapUsedBytes(result.snapshot))})`,
		`${result.snapshot.processes.length} large development process(es) inspected`,
	].join(", ");
	console.log(`Resource report: ${summary}.`);
	if (result.issues.length) {
		for (const issue of result.issues) {
			console.warn(`Resource observation: ${formatResourceIssue(issue)}`);
		}
	}
};

const isMainModule = process.argv[1]
	? fileURLToPath(import.meta.url) === resolve(process.argv[1])
	: false;

if (isMainModule) {
	try {
		main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	}
}
