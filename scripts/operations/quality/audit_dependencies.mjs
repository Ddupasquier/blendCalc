/**
 * Purpose: Show full and production dependency audits and enforce the single
 * reviewed temporary exception. Read-only: contacts npm and the public GitHub
 * advisory API, but never installs, repairs or changes packages or databases.
 * Run: `node scripts/operations/quality/audit_dependencies.mjs`
 */

import { fileURLToPath } from "node:url";
import { runDependencyAudit } from "../../lib/security/run_dependency_audit.mjs";

try {
	await runDependencyAudit({
		repositoryRoot: fileURLToPath(new URL("../../..", import.meta.url)),
	});
} catch (error) {
	console.error(`DEPENDENCY AUDIT REFUSED: ${error.message}`);
	process.exitCode = 1;
}
