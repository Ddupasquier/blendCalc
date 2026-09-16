/**
 * Purpose: Prove that a Rehearsal export login can read only explicit versioned views
 * and cannot mutate data, invoke source/network functions, assume the view owner, or
 * leave disposable database objects behind.
 * Run: `node scripts/operations/rehearsal/prove_export_authorization_boundary.mjs`.
 */

import { runRehearsalExportAuthorizationProof } from "../../lib/rehearsal/export_authorization_boundary.mjs";

try {
	const result = runRehearsalExportAuthorizationProof();
	console.log(
		`Rehearsal export authorization proof passed ${result.checks} checks and removed its disposable database and roles.`,
	);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
