import { execFile } from "node:child_process";
import {
	mkdtemp,
	mkdir,
	readFile,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
	inspectDetectedProject,
	loadRehearsalConfig,
	renderDetectedConfig,
} from "../../scripts/lib/rehearsal/configuration.mjs";

const temporaryRoots = [];
const execute = promisify(execFile);
const cliPath = join(
	process.cwd(),
	"scripts/operations/rehearsal/rehearsal_cli.mjs",
);
const configurationModuleUrl = pathToFileURL(
	join(process.cwd(), "scripts/lib/rehearsal/configuration.mjs"),
).href;

const makeProject = async () => {
	const root = await mkdtemp(join(tmpdir(), "rehearsal-config-test-"));
	temporaryRoots.push(root);
	await Promise.all([
		mkdir(join(root, "supabase/migrations"), { recursive: true }),
		mkdir(join(root, "infrastructure/rehearsal/supabase"), {
			recursive: true,
		}),
	]);
	await writeFile(
		join(root, "package.json"),
		JSON.stringify({
			name: "fixture-project",
			scripts: { dev: "vite", test: "vitest run" },
		}),
	);
	return root;
};

const configSource = (overrides = "") => `
import { defineRehearsalConfig } from ${JSON.stringify(configurationModuleUrl)};
export default defineRehearsalConfig({
	schemaVersion: 1,
	project: { name: "fixture-project" },
	supabase: {
		workdir: ".",
		migrationDirectory: "supabase/migrations",
		rehearsalConfig: "infrastructure/rehearsal/supabase/config.toml",
		runtimeWorkdir: ".rehearsal/runtime",
	},
	baseline: {
		artifactDirectory: ".rehearsal",
		sanitizationPolicy: "infrastructure/rehearsal/policy.json",
	},
	application: { startCommand: "npm run dev", proofCommand: "npm test" },
	runtime: {
		applicationUrl: "http://localhost:5175",
		projectId: "fixture-rehearsal",
		apiPort: 58321,
		databasePort: 58322,
		studioPort: 58323,
	},
	safety: { hostedAccess: "disabled", outboundNetwork: "deny" },
	verification: { commands: ["npm test"] },
	${overrides}
});
`;

afterEach(async () => {
	await Promise.all(
		temporaryRoots
			.splice(0)
			.map((root) => rm(root, { recursive: true, force: true })),
	);
});

describe("Rehearsal configuration", () => {
	it("loads a versioned project contract and resolves only project-owned paths", async () => {
		const root = await makeProject();
		await writeFile(join(root, "rehearsal.config.mjs"), configSource());
		const loaded = await loadRehearsalConfig({ projectRoot: root });

		expect(loaded.config.schemaVersion).toBe(1);
		expect(loaded.config.project.name).toBe("fixture-project");
		expect(loaded.paths.migrationDirectory).toBe(
			join(root, "supabase/migrations"),
		);
		expect(loaded.config.safety.allowedHosts).toEqual([
			"127.0.0.1",
			"::1",
			"localhost",
		]);
		expect(loaded.config.supabase.serviceEnvironmentFile).toBeNull();
		expect(loaded.config.supabase.serviceEnvironmentVariables).toEqual([]);
	});

	it("rejects unknown properties, versions, hosted URLs, and escaping paths", async () => {
		for (const [name, source, expected] of [
			[
				"unknown",
				configSource("mystery: true,"),
				"Unknown Rehearsal configuration property",
			],
			[
				"version",
				configSource().replace("schemaVersion: 1", "schemaVersion: 2"),
				"Unsupported Rehearsal configuration version",
			],
			[
				"hosted",
				configSource().replace(
					"http://localhost:5175",
					"https://project.supabase.co",
				),
				"loopback",
			],
			[
				"escape",
				configSource().replace('"supabase/migrations"', '"../migrations"'),
				"inside the project root",
			],
			[
				"runtime-location",
				configSource().replace(
					'runtimeWorkdir: ".rehearsal/runtime"',
					'runtimeWorkdir: "tmp/rehearsal-runtime"',
				),
				"runtime directory inside",
			],
			[
				"environment-location",
				configSource().replace(
					'application: { startCommand: "npm run dev", proofCommand: "npm test" }',
					'application: { startCommand: "npm run dev", proofCommand: "npm test", environmentFile: ".env" }',
				),
				"file inside",
			],
			[
				"project-id",
				configSource().replace(
					'projectId: "fixture-rehearsal"',
					'projectId: "Fixture Rehearsal"',
				),
				"lowercase letters",
			],
			[
				"service-environment-pair",
				configSource().replace(
					'runtimeWorkdir: ".rehearsal/runtime",',
					'runtimeWorkdir: ".rehearsal/runtime", serviceEnvironmentFile: ".env.rehearsal.local",',
				),
				"must be configured together",
			],
		]) {
			const root = await makeProject();
			const path = join(root, `${name}.config.mjs`);
			await writeFile(path, source);
			await expect(
				loadRehearsalConfig({ projectRoot: root, configPath: path }),
			).rejects.toThrow(expected);
		}
	});

	it("detects safe onboarding facts and renders a fail-closed preview", async () => {
		const root = await makeProject();
		await writeFile(join(root, "package-lock.json"), "{}\n");
		await writeFile(
			join(root, "supabase/config.toml"),
			"project_id = 'fixture'\n",
		);
		const detected = await inspectDetectedProject({ projectRoot: root });
		const source = renderDetectedConfig(detected);

		expect(detected.packageManager).toBe("npm");
		expect(detected.hasSupabaseConfig).toBe(true);
		expect(detected.hasMigrations).toBe(true);
		expect(source).toContain('hostedAccess: "disabled"');
		expect(source).toContain('outboundNetwork: "deny"');
		expect(source).not.toContain("project-ref");
	});

	it("keeps init non-mutating until --write and never overwrites config", async () => {
		const root = await makeProject();
		const destination = join(root, "rehearsal.config.ts");
		const preview = JSON.parse(
			(
				await execute(process.execPath, [cliPath, "init", "--json"], {
					cwd: root,
				})
			).stdout,
		);
		expect(preview.data.mode).toBe("preview");
		await expect(stat(destination)).rejects.toMatchObject({ code: "ENOENT" });

		const written = JSON.parse(
			(
				await execute(
					process.execPath,
					[cliPath, "init", "--write", "--json"],
					{ cwd: root },
				)
			).stdout,
		);
		expect(written.data.mode).toBe("written");
		expect(await readFile(destination, "utf8")).toContain(
			'from "@rehearsal/db"',
		);
		await expect(
			execute(process.execPath, [cliPath, "init", "--write", "--json"], {
				cwd: root,
			}),
		).rejects.toMatchObject({ code: 2 });
	});

	it("provides discoverable help without requiring a project configuration", async () => {
		const root = await makeProject();
		const { stdout } = await execute(process.execPath, [cliPath, "--help"], {
			cwd: root,
		});
		expect(stdout).toContain("Usage: rehearsal <command>");
		expect(stdout).toContain("candidates");
	});
});
