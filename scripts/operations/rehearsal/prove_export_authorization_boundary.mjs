/**
 * Purpose: Prove that BlendCalc's Rehearsal export login can read only its explicit
 * versioned views and cannot mutate data, invoke source/network functions, assume the
 * view owner, or leave disposable database objects behind.
 * Run: `npm run db:rehearsal:prove-export-boundary`.
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
