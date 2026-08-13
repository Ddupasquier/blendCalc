/**
 * Purpose: Preview or push linked Supabase migrations using protected local credentials.
 * A real push fails closed unless every local migration exactly matches origin/main so
 * unfinished branch-only schema cannot change the production database.
 * Preview: `npm run db:push:dry`
 * Execute with confirmation: `npm run db:push`
 * Execute without confirmation: `npm run db:push:auto`
 */

import { execFileSync, spawn } from "node:child_process";
import { config } from "dotenv";
import {
	findMigrationsNotIdenticalToRemoteMain,
	formatMigrationPromotionFailure,
	refreshRemoteMainReference,
} from "../../lib/releases/databaseMigrationPromotion.mjs";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const isDryRun = process.argv.includes("--dry-run");
const shouldConfirmAutomatically = process.argv.includes("--yes");
const args = ["supabase", "db", "push"];
if (shouldConfirmAutomatically) args.push("--yes");
if (isDryRun) args.push("--dry-run");
const keychainService = "blendcalc-supabase-db-password";

if (!isDryRun) {
	try {
		refreshRemoteMainReference();
	} catch {
		console.error(
			"Unable to refresh origin/main. No linked migration was applied. Check the Git remote connection and try again.",
		);
		process.exit(1);
	}

	const migrationFailures = findMigrationsNotIdenticalToRemoteMain();
	if (migrationFailures.length > 0) {
		console.error(formatMigrationPromotionFailure(migrationFailures));
		process.exit(1);
	}
}

const getKeychainPassword = () => {
	try {
		return execFileSync("security", [
			"find-generic-password",
			"-s",
			keychainService,
			"-a",
			process.env.USER ?? "",
			"-w",
		], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return "";
	}
};

const dbPassword =
	process.env.SUPABASE_DB_PASSWORD?.trim() || getKeychainPassword();

if (!dbPassword) {
	console.error(
		[
			"Missing Supabase database password.",
			"Copy .env.moderation.example to .env.moderation.local and add SUPABASE_DB_PASSWORD, or store it once in macOS Keychain:",
			`read -s -p "Supabase DB password: " DB_PASS; echo; security add-generic-password -a "$USER" -s ${keychainService} -w "$DB_PASS" -U; unset DB_PASS`,
			"Then run npm run db:push:auto again.",
		].join("\n"),
	);
	process.exit(1);
}

args.push("--password", dbPassword);

const child = spawn("npx", args, {
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
