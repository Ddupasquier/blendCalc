import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(
	new URL(
		"../../scripts/operations/database/verify_local_migration_history.mjs",
		import.meta.url,
	),
);

// Execute the actual entry point with child-only public config and Docker doubles.
// Refuse at the command boundary so no fixture can read or mutate a real database.
const run = (config) => {
	const preload = `
import fs from "node:fs";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
const read = fs.readFileSync;
fs.readFileSync = (path, ...args) =>
  path instanceof URL && path.pathname.endsWith("/supabase/config.toml")
    ? ${JSON.stringify(config)} : read(path, ...args);
childProcess.spawnSync = (_, args) => ({
  status: 1, stdout: "", stderr: "MIGRATION_TARGET_FIXTURE " + args[2],
});
syncBuiltinESMExports();
`;
	return spawnSync(
		process.execPath,
		["--import", `data:text/javascript,${encodeURIComponent(preload)}`, script],
		{ encoding: "utf8", timeout: 10_000 },
	);
};

describe("configured local migration history target", () => {
	for (const projectId of ["blendcalc", "blendcalc-dev109-qa094-app"]) {
		it(`reads the configured ${projectId} container`, () => {
			const result = run(`project_id = "${projectId}"\n`);
			expect(result.error).toBeUndefined();
			expect(result.status).toBe(1);
			expect(result.stderr).toContain(
				`MIGRATION_TARGET_FIXTURE supabase_db_${projectId}`,
			);
		});
	}

	for (const config of [
		"[db]\nmajor_version = 17\n",
		'project_id = "../../hosted"\n',
	]) {
		it(`refuses missing or unsafe project configuration: ${config.trim()}`, () => {
			const result = run(config);
			expect(result.error).toBeUndefined();
			expect(result.status).toBe(1);
			expect(result.stderr).toContain(
				"The configured local migration project ID is unavailable or invalid.",
			);
			expect(result.stderr).not.toContain("MIGRATION_TARGET_FIXTURE");
		});
	}
});
