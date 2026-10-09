import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getCanonicalLocalRepositoryRoot,
	localSupabaseCommandArguments,
	prepareLocalSupabaseWorkdir,
} from "../../scripts/lib/environment/local_supabase_workdir.mjs";
import { assertLocalConfigurationChangeSafe } from "../../scripts/lib/environment/local_supabase.mjs";

const roots = [];
afterEach(() => {
	for (const root of roots.splice(0))
		rmSync(root, { recursive: true, force: true });
});
const fixture = (projectId = "blendcalc") => {
	const root = mkdtempSync(join(tmpdir(), "blendcalc-local-inputs-"));
	roots.push(root);
	const source = join(root, "supabase");
	for (const directory of [
		"migrations",
		"templates",
		"tests/database",
		".temp",
	])
		mkdirSync(join(source, directory), { recursive: true });
	writeFileSync(
		join(source, "config.toml"),
		`project_id = "${projectId}"\n[db]\nmajor_version = 17\n`,
	);
	writeFileSync(join(source, "seed.sql"), "select 1;\n");
	writeFileSync(
		join(source, "migrations/20260101000000_initial.sql"),
		"select 2;\n",
	);
	writeFileSync(
		join(source, "tests/database/fixture.sql"),
		"begin; rollback;\n",
	);
	writeFileSync(
		join(source, "templates/confirmation.html"),
		"<p>Public template</p>\n",
	);
	writeFileSync(join(source, ".temp/project-ref"), "SOURCE_LINK_CANARY");
	writeFileSync(join(source, ".temp/storage-version"), "SOURCE_VERSION_CANARY");
	writeFileSync(join(source, ".env.local"), "SOURCE_SECRET_CANARY");
	return { root, source, options: { cwd: root, canonicalRoot: root } };
};

describe("owned local Supabase workdirs", () => {
	it("permits config changes only when the exact owned project is stopped", () => {
		const execute = vi.fn(() => ({ status: 0, stdout: "" }));
		expect(() =>
			assertLocalConfigurationChangeSafe("blendcalc", "/fixture", execute),
		).not.toThrow();
		expect(execute.mock.calls[0][1]).toEqual([
			"ps",
			"--filter",
			"label=com.supabase.cli.project=blendcalc",
			"--format",
			"{{.ID}}",
		]);
		for (const result of [
			{ status: 0, stdout: "owned-container\n" },
			{ status: 1, stdout: "" },
			{ status: 0, stdout: "", error: new Error("SECRET_CANARY") },
		]) {
			expect(() =>
				assertLocalConfigurationChangeSafe(
					"blendcalc",
					"/fixture",
					() => result,
				),
			).toThrow("Stop the owned local stack");
		}
	});
	it("stages exact public files without copying hosted metadata or environment files", () => {
		const { source, options } = fixture();
		const runtime = prepareLocalSupabaseWorkdir(options);
		expect(runtime).toBe(join(options.cwd, ".cache/local-supabase/blendcalc"));
		for (const name of [
			"config.toml",
			"seed.sql",
			"migrations/20260101000000_initial.sql",
			"tests/database/fixture.sql",
			"templates/confirmation.html",
		]) {
			expect(readFileSync(join(runtime, "supabase", name))).toEqual(
				readFileSync(join(source, name)),
			);
		}
		expect(existsSync(join(runtime, "supabase/.temp"))).toBe(false);
		expect(existsSync(join(runtime, "supabase/.env.local"))).toBe(false);
		expect(readFileSync(join(source, ".temp/project-ref"), "utf8")).toBe(
			"SOURCE_LINK_CANARY",
		);
	});

	it("retains generated CLI state and does not change template bytes on a repeat", () => {
		const { options } = fixture();
		const runtime = prepareLocalSupabaseWorkdir(options);
		mkdirSync(join(runtime, "supabase/.temp"));
		writeFileSync(
			join(runtime, "supabase/.temp/storage-version"),
			"LOCAL_VERSION",
		);
		expect(prepareLocalSupabaseWorkdir(options)).toBe(runtime);
		expect(
			readFileSync(join(runtime, "supabase/.temp/storage-version"), "utf8"),
		).toBe("LOCAL_VERSION");
	});
	it("includes public configured function sources but never their environment files", () => {
		const { source, options } = fixture();
		mkdirSync(join(source, "functions/catalog-monitor"), { recursive: true });
		writeFileSync(
			join(source, "functions/catalog-monitor/index.ts"),
			"export const ready = true;\n",
		);
		writeFileSync(join(source, "functions/deno.json"), '{"imports":{}}');
		writeFileSync(
			join(source, "functions/.env.local"),
			"FUNCTION_SECRET_CANARY",
		);
		const runtime = prepareLocalSupabaseWorkdir(options);
		expect(
			readFileSync(
				join(runtime, "supabase/functions/catalog-monitor/index.ts"),
				"utf8",
			),
		).toBe("export const ready = true;\n");
		expect(
			readFileSync(join(runtime, "supabase/functions/deno.json"), "utf8"),
		).toBe('{"imports":{}}');
		expect(existsSync(join(runtime, "supabase/functions/.env.local"))).toBe(
			false,
		);
	});

	it("keeps a publication target and nested workdir independent", () => {
		const { root, options } = fixture();
		const api = join(root, "infrastructure/api/supabase");
		mkdirSync(api, { recursive: true });
		writeFileSync(join(api, "config.toml"), 'project_id = "blendCalcAPI"\n');
		const primary = prepareLocalSupabaseWorkdir(options);
		const publication = prepareLocalSupabaseWorkdir({
			...options,
			workdir: "infrastructure/api",
		});
		expect(publication).not.toBe(primary);
		expect(publication).toBe(join(root, ".cache/local-supabase/blendCalcAPI"));
	});

	it("stages new migrations while leaving config and mounted templates unchanged", () => {
		const { source, options } = fixture();
		const runtime = prepareLocalSupabaseWorkdir(options);
		writeFileSync(
			join(source, "migrations/20260102000000_new.sql"),
			"select 3;\n",
		);
		const gate = vi.fn();
		prepareLocalSupabaseWorkdir({
			...options,
			assertConfigurationChangeSafe: gate,
		});
		expect(gate).not.toHaveBeenCalled();
		expect(
			readFileSync(
				join(runtime, "supabase/migrations/20260102000000_new.sql"),
				"utf8",
			),
		).toBe("select 3;\n");
	});

	it("refuses changed mounted inputs before any cached bytes change", () => {
		const { source, options } = fixture();
		const runtime = prepareLocalSupabaseWorkdir(options);
		const template = join(runtime, "supabase/templates/confirmation.html");
		const original = readFileSync(template);
		writeFileSync(
			join(source, "templates/confirmation.html"),
			"<p>New template</p>\n",
		);
		expect(() => prepareLocalSupabaseWorkdir(options)).toThrow(
			"Stop the local stack",
		);
		expect(readFileSync(template)).toEqual(original);
	});

	it("status and stop do not restage changed source config", () => {
		const { source, options } = fixture();
		const runtime = prepareLocalSupabaseWorkdir(options);
		const original = readFileSync(join(runtime, "supabase/config.toml"));
		writeFileSync(
			join(source, "config.toml"),
			'project_id = "blendcalc"\n[api]\nport = 54329\n',
		);
		for (const command of ["status", "stop"])
			expect(localSupabaseCommandArguments([command], options)).toEqual([
				command,
				"--workdir",
				runtime,
			]);
		expect(readFileSync(join(runtime, "supabase/config.toml"))).toEqual(
			original,
		);
	});

	it("allows a reviewed stopped-stack template update and removes only owned obsolete inputs", () => {
		const { source, options } = fixture();
		const runtime = prepareLocalSupabaseWorkdir(options);
		writeFileSync(join(source, "templates/confirmation.html"), "<p>New</p>\n");
		rmSync(join(source, "tests/database/fixture.sql"));
		const gate = vi.fn();
		prepareLocalSupabaseWorkdir({
			...options,
			assertConfigurationChangeSafe: gate,
		});
		expect(gate).toHaveBeenCalledWith("blendcalc");
		expect(
			readFileSync(
				join(runtime, "supabase/templates/confirmation.html"),
				"utf8",
			),
		).toBe("<p>New</p>\n");
		expect(
			existsSync(join(runtime, "supabase/tests/database/fixture.sql")),
		).toBe(false);
	});

	it("refuses edits to derived inputs rather than overwriting them", () => {
		const { options } = fixture();
		const runtime = prepareLocalSupabaseWorkdir(options);
		writeFileSync(join(runtime, "supabase/seed.sql"), "select 99;\n");
		expect(() => prepareLocalSupabaseWorkdir(options)).toThrow("were edited");
		expect(readFileSync(join(runtime, "supabase/seed.sql"), "utf8")).toBe(
			"select 99;\n",
		);
	});

	it.each(["../escape", "bad/name", "", "space name"])(
		"refuses unsafe project ids: %s",
		(id) => {
			const { options } = fixture(id);
			expect(() => prepareLocalSupabaseWorkdir(options)).toThrow(
				"safe project id",
			);
			expect(existsSync(join(options.cwd, ".cache"))).toBe(false);
		},
	);

	it("refuses input links and cached parent links without touching their targets", () => {
		const { source, options } = fixture();
		symlinkSync(
			join(source, "seed.sql"),
			join(source, "migrations/20260102000000_link.sql"),
		);
		expect(() => prepareLocalSupabaseWorkdir(options)).toThrow("symlinked");
		rmSync(join(source, "migrations/20260102000000_link.sql"));
		const runtime = prepareLocalSupabaseWorkdir(options);
		rmSync(join(runtime, "supabase/templates"), { recursive: true });
		symlinkSync(join(source, "templates"), join(runtime, "supabase/templates"));
		expect(() => prepareLocalSupabaseWorkdir(options)).toThrow(
			"parent directories",
		);
		expect(
			readFileSync(join(source, "templates/confirmation.html"), "utf8"),
		).toBe("<p>Public template</p>\n");
	});

	it("refuses hosted metadata introduced into the owned cache", () => {
		const { options } = fixture();
		const runtime = prepareLocalSupabaseWorkdir(options);
		mkdirSync(join(runtime, "supabase/.temp"));
		writeFileSync(
			join(runtime, "supabase/.temp/project-ref"),
			"DESTINATION_LINK_CANARY",
		);
		expect(() => prepareLocalSupabaseWorkdir(options)).toThrow(
			"hosted link metadata",
		);
	});
	it("refuses a concurrent preparation and does not remove another owner's lock", () => {
		const { options } = fixture();
		const runtime = prepareLocalSupabaseWorkdir(options);
		const lock = join(runtime, ".input-preparation.lock");
		writeFileSync(lock, "other-owner");
		expect(() => prepareLocalSupabaseWorkdir(options)).toThrow(
			"already locked",
		);
		expect(readFileSync(lock, "utf8")).toBe("other-owner");
	});

	it("refuses receipt traversal before touching public source or foreign files", () => {
		const { source, options } = fixture();
		const runtime = prepareLocalSupabaseWorkdir(options);
		writeFileSync(
			join(runtime, ".blendcalc-local-inputs.json"),
			JSON.stringify({
				version: 1,
				projectId: "blendcalc",
				files: { "../../foreign.sql": "a".repeat(64) },
			}),
		);
		expect(() => prepareLocalSupabaseWorkdir(options)).toThrow("unsafe path");
		expect(readFileSync(join(source, "seed.sql"), "utf8")).toBe("select 1;\n");
		expect(existsSync(join(runtime, ".input-preparation.lock"))).toBe(false);
	});

	it.each([
		["db", "reset", "--linked"],
		["db", "reset", "--db-url=SECRET_CANARY"],
		["link", "--project-ref", "SECRET_CANARY"],
		["db", "push"],
		["start", "--workdir=other"],
		["start", "--workdir"],
		["start", "--workdir", ".", "--workdir", "other"],
	])("refuses unsafe or ambiguous CLI arguments", (...args) => {
		const { options } = fixture();
		expect(() => localSupabaseCommandArguments(args, options)).toThrow();
		expect(existsSync(join(options.cwd, ".cache"))).toBe(false);
	});

	it("uses the primary repository root across an auxiliary checkout", () => {
		const { root } = fixture();
		execFileSync("git", ["init", "--quiet", root]);
		execFileSync(
			"git",
			[
				"-C",
				root,
				"-c",
				"user.name=Fixture",
				"-c",
				"user.email=fixture@example.test",
				"commit",
				"--allow-empty",
				"-m",
				"fixture",
			],
			{ stdio: "ignore" },
		);
		const other = join(root, "auxiliary");
		execFileSync(
			"git",
			["-C", root, "worktree", "add", "--detach", other, "HEAD"],
			{ stdio: "ignore" },
		);
		expect(getCanonicalLocalRepositoryRoot(other)).toBe(realpathSync(root));
	});
});
