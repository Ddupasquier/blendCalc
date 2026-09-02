/**
 * Purpose: Report whether the local machine is safe to start resource-intensive
 * repository verification without modifying files or processes.
 * Run: `npm run resources:check`.
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	assertLocalResourceSafety,
	formatGibibytes,
	formatResourceIssue,
} from "../../lib/quality/resource_safety.mjs";

export const main = () => {
	const result = assertLocalResourceSafety();
	if (result.skipped) {
		console.log("Resource safety check skipped in CI.");
		return;
	}
	const summary = [
		`startup disk ${formatGibibytes(result.snapshot.startupDiskFreeBytes)} free`,
		result.snapshot.swapUsedBytes === null
			? "swap unavailable"
			: `swap ${formatGibibytes(result.snapshot.swapUsedBytes)} used`,
		`${result.snapshot.processes.length} large development process(es) inspected`,
	].join(", ");
	console.log(`Resource safety: ${summary}.`);
	if (result.overridden) {
		for (const issue of result.issues) {
			console.warn(`Override: ${formatResourceIssue(issue)}`);
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
