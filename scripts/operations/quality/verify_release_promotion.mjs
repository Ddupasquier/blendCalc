/**
 * Purpose: Reuse a successful content-addressed Release Check only when the
 * promoted Git tree is unchanged, clean, current, and from the same runtime.
 * Run: `npm run verify:promotion`
 * Force: `npm run verify:promotion -- --force-full`
 * CI tree check: `node scripts/operations/quality/verify_release_promotion.mjs --against <verified-ref>`
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
	verifyMatchingGitTrees,
	verifyReleaseReceipt,
} from "../../lib/quality/release_verification_receipt.mjs";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const args = process.argv.slice(2);

if (args.includes("--force-full")) {
	const result = spawnSync("npm", ["run", "verify:release"], {
		cwd: repositoryRoot,
		stdio: "inherit",
	});
	process.exitCode = result.status ?? 1;
} else {
	const againstIndex = args.indexOf("--against");
	if (againstIndex >= 0) {
		const expectedReference = args[againstIndex + 1];
		if (!expectedReference) {
			throw new Error("--against requires a Git reference.");
		}
		const { currentTree } = verifyMatchingGitTrees(
			repositoryRoot,
			expectedReference,
		);
		console.log(
			`Promotion integrity passed: ${currentTree} matches ${expectedReference}.`,
		);
	} else {
		const { receipt } = await verifyReleaseReceipt(repositoryRoot);
		console.log(
			`Promotion Check passed: tree ${receipt.tree} was fully verified at ${receipt.verifiedAt}.`,
		);
	}
}
