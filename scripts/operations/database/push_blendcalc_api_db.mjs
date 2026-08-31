/**
 * Purpose: Preview or push isolated blendCalcAPI migrations using a dedicated link and
 * credentials after every migration has identical reviewed source on remote main.
 * Preview: `npm run blendCalcAPI:db:push:dry`
 * Execute with confirmation: `npm run blendCalcAPI:db:push`
 * Execute without confirmation: `npm run blendCalcAPI:db:push:auto`
 */

import { execFileSync } from "node:child_process";
import { readFileSync as readTextFile } from "node:fs";
import { spawn } from "node:child_process";
import { config } from "dotenv";
import {
	findMigrationsNotIdenticalToRemoteMain,
	formatMigrationPromotionFailure,
	refreshRemoteMainReference,
} from "../../lib/releases/databaseMigrationPromotion.mjs";

config({ path: ".env.blendCalcAPI.local", quiet: true });

const workdir = "infrastructure/blendCalcAPI";
const migrationsDirectory = `${workdir}/supabase/migrations`;
const keychainService = "blendCalcAPI-supabase-db-password";
const isDryRun = process.argv.includes("--dry-run");
const shouldConfirmAutomatically = process.argv.includes("--yes");

const expectedProjectRef =
	process.env.BLENDCALC_API_SUPABASE_PROJECT_ID?.trim();
const linkedProjectRef = readTextFile(
	`${workdir}/supabase/.temp/project-ref`,
	"utf8",
).trim();

if (!expectedProjectRef || linkedProjectRef !== expectedProjectRef) {
	console.error(
		"The isolated Supabase link does not match BLENDCALC_API_SUPABASE_PROJECT_ID. No database change was attempted.",
	);
	process.exit(1);
}

if (!isDryRun) {
	try {
		refreshRemoteMainReference();
	} catch {
		console.error(
			"Unable to refresh origin/main. No isolated migration was applied.",
		);
		process.exit(1);
	}

	const migrationFailures = findMigrationsNotIdenticalToRemoteMain({
		migrationsDirectory,
	});
	if (migrationFailures.length > 0) {
		console.error(formatMigrationPromotionFailure(migrationFailures));
		process.exit(1);
	}
}

const getKeychainPassword = () => {
	try {
		return execFileSync(
			"security",
			[
				"find-generic-password",
				"-s",
				keychainService,
				"-a",
				process.env.USER ?? "",
				"-w",
			],
			{
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
			},
		).trim();
	} catch {
		return "";
	}
};

const dbPassword =
	process.env.BLENDCALC_API_SUPABASE_DB_PASSWORD?.trim() ||
	getKeychainPassword();
if (!dbPassword) {
	console.error(
		`Missing isolated database password. Store it in the ${keychainService} Keychain item or .env.blendCalcAPI.local.`,
	);
	process.exit(1);
}

const argumentsList = ["supabase", "db", "push", "--workdir", workdir];
if (shouldConfirmAutomatically) argumentsList.push("--yes");
if (isDryRun) argumentsList.push("--dry-run");
argumentsList.push("--password", dbPassword);

const child = spawn("npx", argumentsList, {
	stdio: "inherit",
	env: process.env,
});

child.on("exit", (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}
	process.exit(code ?? 1);
});
