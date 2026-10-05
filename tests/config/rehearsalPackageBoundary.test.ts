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

// Build the complete on-disk fixture inventory once, including uncommitted additions
// and excluding deleted files. Disk discovery is setup, not a timed assertion.
const packageImportInventory = execFileSync(
	"git",
	[
		"ls-files",
		"--cached",
		"--others",
		"--exclude-standard",
		"--",
		"rehearsal.config.mjs",
		"scripts",
		"infrastructure",
		"src",
		"tests",
	],
	{ encoding: "utf8" },
)
	.trim()
	.split("\n")
	.filter(
		(file) => /\.(?:cjs|js|mjs|ts|svelte)$/u.test(file) && existsSync(file),
	)
	.flatMap((file) => {
		const source = readFileSync(file, "utf8");
		if (!source.includes("@rehearsal-db/core")) return [];
		return [
			...source.matchAll(
				/(?:from\s+|import\s*\()\s*["'](@rehearsal-db\/core(?:\/[^"']*)?)["']/gu,
			),
		].map((match) => ({ file, entryPoint: match[1] }));
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
			"infrastructure/rehearsal/application/runtime_adapter.mjs",
			"scripts/operations/rehearsal/prove_rehearsal_application.mjs",
			"scripts/operations/rehearsal/verify_local_migration_history.mjs",
		];

		for (const path of packageOwnedPaths) {
			expect(existsSync(path), path).toBe(false);
		}
	});

	it("labels every retained local module as BlendCalc-owned", () => {
		const files = [
			...projectOwnedRehearsalRoots.flatMap(collectSourceFiles),
			"rehearsal.config.mjs",
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
			"@rehearsal-db/core/baseline-builder",
			"@rehearsal-db/core/diagnostics",
			"@rehearsal-db/core/migrations",
			"@rehearsal-db/core/process-environment",
			"@rehearsal-db/core/schema",
			"@rehearsal-db/core/service-environment",
			"@rehearsal-db/core/source-access",
			"@rehearsal-db/core/privacy",
		]);
		for (const { file, entryPoint } of packageImportInventory) {
			expect(allowedPackageImports, `${file}: ${entryPoint}`).toContain(
				entryPoint,
			);
		}
	});

	it("delegates the argument-based lifecycle command directly to the package CLI", () => {
		expect(packageMetadata.scripts?.rehearsal).toBe("rehearsal");
		for (const action of [
			"start",
			"reset",
			"status",
			"stop",
			"discard",
			"candidates",
			"migrate",
			"verify",
			"run",
		]) {
			expect(packageMetadata.scripts).not.toHaveProperty(
				`db:rehearsal:${action}`,
			);
		}
		for (const command of [
			"dev:rehearsal",
			"predev:rehearsal",
			"free:rehearsal-port",
			"rehearsal:app:prove",
		]) {
			expect(packageMetadata.scripts).not.toHaveProperty(command);
		}
	});

	it("uses declarations and public package-owned application orchestration", async () => {
		const { default: config } = await import("../../rehearsal.config.mjs");
		expect(config.application).not.toHaveProperty("runtimeAdapter");
		expect(config.application.startCommand).toContain(
			"node node_modules/vite/bin/vite.js dev --mode rehearsal",
		);
		expect(config.application.proofCommand).toBe(
			"node scripts/operations/quality/prove_local_application.mjs",
		);
		expect(
			config.application.environmentVariables.BLENDCALC_API_SUPABASE_URL,
		).toBe("publication-api:SUPABASE_URL");
		expect(config.application.readiness.url).toBe("http://localhost:5175/auth");
		expect(config.dependentTargets).toHaveLength(1);
		const identity = JSON.parse(readFileSync(config.identityPolicy, "utf8"))
			.identities[0];
		expect(identity.matcher.emailEnvironmentVariable).toBe(
			"REHEARSAL_APPROVED_OWNER_EMAIL",
		);
		expect(identity.matcher.approvedEmailSha256).toMatch(/^[a-f0-9]{64}$/u);
		expect(identity.references).toHaveLength(69);
		expect(
			identity.references.find(
				(reference: { table: string; column: string }) =>
					reference.table === "food_compatibility_feedback" &&
					reference.column === "reviewed_by",
			).strategy,
		).toBe("preserve-audit");
		expect(identity.signupDefaults).toHaveLength(2);
		expect(identity.assets).toHaveLength(2);
		expect(identity.pathReferences).toHaveLength(5);
	});

	it("discovers the active config beside package.json without a nested duplicate", async () => {
		const { loadRehearsalConfig } = await import("@rehearsal-db/core");
		const loaded = await loadRehearsalConfig({ projectRoot: process.cwd() });
		expect(loaded).toMatchObject({
			configPath: join(process.cwd(), "rehearsal.config.mjs"),
		});
		expect(existsSync("infrastructure/rehearsal/rehearsal.config.mjs")).toBe(
			false,
		);
	});

	it("refuses to launch Rehearsal through the QA launcher before touching a database", () => {
		expect(() =>
			execFileSync(
				process.execPath,
				[
					"scripts/operations/environment/run_application_environment.mjs",
					"rehearsal",
				],
				{ encoding: "utf8", stdio: "pipe" },
			),
		).toThrow("The QA application launcher accepts only test");
	});

	it("keeps ordinary application proofs free of launchers, package internals and copied-owner credentials", () => {
		const source = readFileSync(
			"scripts/operations/quality/prove_local_application.mjs",
			"utf8",
		);
		expect(source).not.toMatch(
			/node:child_process|runtime_adapter|BLENDCALC_REHEARSAL_ACCOUNT|@rehearsal-db/u,
		);
	});
});
