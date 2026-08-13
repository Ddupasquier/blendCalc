import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	findMigrationsNotIdenticalToRemoteMain,
	formatMigrationPromotionFailure,
	refreshRemoteMainReference,
} from "../../scripts/lib/releases/databaseMigrationPromotion.mjs";

const temporaryDirectories = [];

const createMigrationRepository = async (migrations) => {
	const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "blendcalc-migrations-"));
	temporaryDirectories.push(repositoryRoot);
	const migrationsDirectory = path.join(repositoryRoot, "supabase/migrations");
	await mkdir(migrationsDirectory, { recursive: true });
	await Promise.all(Object.entries(migrations).map(([fileName, contents]) =>
		writeFile(path.join(migrationsDirectory, fileName), contents, "utf8")
	));
	return repositoryRoot;
};

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) =>
		rm(directory, { recursive: true, force: true })
	));
});

describe("linked migration promotion guard", () => {
	it("keeps every maintained linked push behind the promotion guard", async () => {
		const packageMetadata = JSON.parse(await readFile("package.json", "utf8"));
		const pushWorkflowSource = await readFile(
			"scripts/operations/database/push_supabase_db.mjs",
			"utf8",
		);

		expect(packageMetadata.scripts["db:push"]).toBe(
			"node scripts/operations/database/push_supabase_db.mjs",
		);
		expect(packageMetadata.scripts["db:push:auto"]).toBe(
			"node scripts/operations/database/push_supabase_db.mjs --yes",
		);
		expect(pushWorkflowSource).toContain("findMigrationsNotIdenticalToRemoteMain");
		expect(pushWorkflowSource.indexOf("findMigrationsNotIdenticalToRemoteMain()"))
			.toBeLessThan(pushWorkflowSource.indexOf("const dbPassword"));
	});

	it("accepts migrations whose exact contents are already on remote main", async () => {
		const repositoryRoot = await createMigrationRepository({
			"20260812000000_safe_expansion.sql": "alter table foods add column note text;\n",
		});

		expect(findMigrationsNotIdenticalToRemoteMain({
			repositoryRoot,
			readPromotedMigration: () => "alter table foods add column note text;\n",
		})).toEqual([]);
	});

	it("rejects branch-only and modified migration source", async () => {
		const repositoryRoot = await createMigrationRepository({
			"20260812000000_branch_only.sql": "select 1;\n",
			"20260812000001_modified.sql": "select 2;\n",
		});

		const failures = findMigrationsNotIdenticalToRemoteMain({
			repositoryRoot,
			readPromotedMigration: (relativePath) => {
				if (relativePath.endsWith("branch_only.sql")) return null;
				return "select 3;\n";
			},
		});

		expect(failures).toEqual([
			{
				fileName: "20260812000000_branch_only.sql",
				reason: "is not present on origin/main",
			},
			{
				fileName: "20260812000001_modified.sql",
				reason: "differs from the version on origin/main",
			},
		]);
		expect(formatMigrationPromotionFailure(failures)).toContain(
			"Do not include application code that requires the new schema",
		);
	});

	it("refreshes and verifies the remote main reference before inspection", () => {
		const commands = [];
		refreshRemoteMainReference({
			repositoryRoot: "/repository",
			runGitCommand: (argumentsList, repositoryRoot) => {
				commands.push({ argumentsList, repositoryRoot });
			},
		});

		expect(commands).toEqual([
			{
				argumentsList: ["fetch", "--quiet", "origin", "main"],
				repositoryRoot: "/repository",
			},
			{
				argumentsList: ["rev-parse", "--verify", "origin/main"],
				repositoryRoot: "/repository",
			},
		]);
	});
});
