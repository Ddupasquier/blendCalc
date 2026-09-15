import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageMetadata = {
	scripts?: Record<string, string>;
};

const packageMetadata = JSON.parse(
	readFileSync("package.json", "utf8"),
) as PackageMetadata;

const projectOwnedRehearsalRoots = [
	"scripts/lib/rehearsal",
	"scripts/generators/rehearsal",
	"scripts/operations/rehearsal",
	"infrastructure/rehearsal/application",
];

const collectSourceFiles = (directory: string): string[] =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return collectSourceFiles(path);
		return /\.(?:js|mjs|svelte|ts)$/u.test(entry.name) ? [path] : [];
	});

describe("Rehearsal package consumer boundary", () => {
	it("keeps package-owned engine modules out of BlendCalc", () => {
		const packageOwnedPaths = [
			"scripts/lib/rehearsal/baseline_artifact.mjs",
			"scripts/lib/rehearsal/baseline_builder.mjs",
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
		];

		for (const path of packageOwnedPaths) {
			expect(existsSync(path), path).toBe(false);
		}
	});

	it("labels every retained local module as BlendCalc-owned", () => {
		const files = [
			...projectOwnedRehearsalRoots.flatMap(collectSourceFiles),
			"infrastructure/rehearsal/rehearsal.config.mjs",
		];

		for (const file of files) {
			const ownershipHeader = readFileSync(file, "utf8")
				.split("\n")
				.slice(0, 12)
				.join("\n");
			expect(ownershipHeader, file).toMatch(/BlendCalc|project-owned/u);
		}
	});

	it("imports only public package entry points", () => {
		const allowedPackageImports = new Set([
			"@rehearsal-db/core",
			"@rehearsal-db/core/baseline",
			"@rehearsal-db/core/diagnostics",
			"@rehearsal-db/core/migrations",
			"@rehearsal-db/core/process-environment",
			"@rehearsal-db/core/schema",
			"@rehearsal-db/core/service-environment",
		]);
		const sourceFiles = execFileSync(
			"git",
			[
				"grep",
				"--files-with-matches",
				"@rehearsal-db/core",
				"--",
				"scripts",
				"infrastructure",
				"src",
				"tests",
			],
			{ encoding: "utf8" },
		)
			.trim()
			.split("\n")
			.filter(Boolean);

		for (const file of sourceFiles) {
			const source = readFileSync(file, "utf8");
			const imports = source.matchAll(
				/(?:from\s+|import\s*\()\s*["'](@rehearsal-db\/core(?:\/[^"']*)?)["']/gu,
			);
			for (const match of imports) {
				expect(allowedPackageImports, `${file}: ${match[1]}`).toContain(
					match[1],
				);
			}
		}
	});

	it("delegates generic lifecycle commands directly to the package CLI", () => {
		const expectedCommands = {
			"db:rehearsal:start": "rehearsal start",
			"db:rehearsal:reset": "rehearsal reset",
			"db:rehearsal:status": "rehearsal status",
			"db:rehearsal:stop": "rehearsal stop",
			"db:rehearsal:discard": "rehearsal discard",
			"db:rehearsal:candidates": "rehearsal candidates",
			"db:rehearsal:migrate": "rehearsal migrate",
			"db:rehearsal:verify": "rehearsal verify",
			"db:rehearsal:run": "rehearsal run",
			rehearsal: "rehearsal",
		};

		for (const [name, command] of Object.entries(expectedCommands)) {
			expect(packageMetadata.scripts?.[name], name).toBe(command);
		}
	});
});
