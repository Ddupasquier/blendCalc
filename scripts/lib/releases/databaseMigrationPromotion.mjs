/**
 * Purpose: Verify that every local Supabase migration has identical reviewed source on
 * the remote main branch before a linked database push can change production.
 * Do not run directly; this helper is used by the guarded linked migration workflow.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_MAIN_REFERENCE = "origin/main";
const MIGRATIONS_DIRECTORY = "supabase/migrations";

const runGit = (argumentsList, repositoryRoot) => execFileSync(
	"git",
	argumentsList,
	{
		cwd: repositoryRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	},
);

export const refreshRemoteMainReference = ({
	repositoryRoot = process.cwd(),
	runGitCommand = runGit,
} = {}) => {
	runGitCommand(["fetch", "--quiet", "origin", "main"], repositoryRoot);
	runGitCommand(["rev-parse", "--verify", DEFAULT_MAIN_REFERENCE], repositoryRoot);
};

export const findMigrationsNotIdenticalToRemoteMain = ({
	repositoryRoot = process.cwd(),
	mainReference = DEFAULT_MAIN_REFERENCE,
	readPromotedMigration,
} = {}) => {
	const migrationsDirectoryPath = path.join(repositoryRoot, MIGRATIONS_DIRECTORY);
	const migrationFileNames = readdirSync(migrationsDirectoryPath)
		.filter((fileName) => fileName.endsWith(".sql"))
		.sort();
	const readRemoteMigration = readPromotedMigration ?? ((relativePath) => {
		try {
			return runGit(["show", `${mainReference}:${relativePath}`], repositoryRoot);
		} catch {
			return null;
		}
	});

	return migrationFileNames.flatMap((fileName) => {
		const relativePath = `${MIGRATIONS_DIRECTORY}/${fileName}`;
		const localContents = readFileSync(path.join(repositoryRoot, relativePath), "utf8");
		const promotedContents = readRemoteMigration(relativePath);
		if (promotedContents === localContents) return [];

		return [{
			fileName,
			reason: promotedContents === null
				? "is not present on origin/main"
				: "differs from the version on origin/main",
		}];
	});
};

export const formatMigrationPromotionFailure = (migrationFailures) => [
	"Refusing to change the linked database because local migrations are not fully promoted to origin/main:",
	...migrationFailures.map(({ fileName, reason }) => `- ${fileName} ${reason}`),
	"Promote the backward-compatible expansion migration, schema documentation, generated types, and database tests to main first.",
	"Do not include application code that requires the new schema in that expansion release.",
	"After origin/main is current, rerun the dry run and guarded push, verify production, and only then promote dependent application code.",
].join("\n");
