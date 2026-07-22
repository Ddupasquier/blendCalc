import { execFileSync, spawn } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const args = ["supabase", "db", "push", "--yes"];
if (process.argv.includes("--dry-run")) args.push("--dry-run");
const keychainService = "blendcalc-supabase-db-password";

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
