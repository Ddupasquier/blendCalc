/**
 * Purpose: Assemble the exact prospective Rehearsal npm package from an explicit
 * allowlist for package audits and independent installation proofs.
 * Do not run directly; this module is repository-owned release infrastructure.
 */

import { cp, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const REHEARSAL_PACKAGE_DOCUMENTS = Object.freeze([
	"README.md",
	"BENCHMARKS.md",
	"CHANGELOG.md",
	"SECURITY.md",
	"COMPATIBILITY.md",
	"LICENSE",
]);

export const REHEARSAL_PACKAGE_SOURCES = Object.freeze([
	"scripts/lib/environment/local_supabase.mjs",
	"scripts/lib/rehearsal/baseline_artifact.mjs",
	"scripts/lib/rehearsal/configuration.d.mts",
	"scripts/lib/rehearsal/configuration.mjs",
	"scripts/lib/rehearsal/diagnostics.mjs",
	"scripts/lib/rehearsal/migration_history.mjs",
	"scripts/lib/rehearsal/plan.mjs",
	"scripts/lib/rehearsal/process_environment.mjs",
	"scripts/lib/rehearsal/runtime_restore.mjs",
	"scripts/lib/rehearsal/schema_snapshot.mjs",
	"scripts/lib/rehearsal/service_environment.mjs",
	"scripts/operations/database/manage_rehearsal_database.mjs",
	"scripts/operations/rehearsal/rehearsal_cli.mjs",
]);

export const REHEARSAL_PACKAGE_MANIFEST = Object.freeze({
	name: "@rehearsal/db",
	version: "0.1.0-beta.0",
	private: true,
	description:
		"Safely rehearse PostgreSQL and Supabase migrations against sanitized production-shaped data.",
	type: "module",
	engines: { node: ">=24 <25" },
	bin: { rehearsal: "scripts/operations/rehearsal/rehearsal_cli.mjs" },
	exports: {
		".": {
			types: "./scripts/lib/rehearsal/configuration.d.mts",
			import: "./scripts/lib/rehearsal/configuration.mjs",
		},
	},
	files: ["scripts", ...REHEARSAL_PACKAGE_DOCUMENTS],
	keywords: ["postgresql", "supabase", "migration", "testing", "database"],
	license: "MIT",
	dependencies: {},
});

export const assembleProspectiveRehearsalPackage = async ({
	repositoryRoot,
	destination,
}) => {
	for (const source of REHEARSAL_PACKAGE_SOURCES) {
		const target = join(destination, source);
		await mkdir(dirname(target), { recursive: true });
		await cp(join(repositoryRoot, source), target);
	}
	for (const document of REHEARSAL_PACKAGE_DOCUMENTS) {
		await cp(
			join(repositoryRoot, "infrastructure/rehearsal/package", document),
			join(destination, document),
		);
	}
	await writeFile(
		join(destination, "package.json"),
		`${JSON.stringify(REHEARSAL_PACKAGE_MANIFEST, null, "\t")}\n`,
	);
	return {
		documents: REHEARSAL_PACKAGE_DOCUMENTS,
		manifest: REHEARSAL_PACKAGE_MANIFEST,
		sources: REHEARSAL_PACKAGE_SOURCES,
	};
};
