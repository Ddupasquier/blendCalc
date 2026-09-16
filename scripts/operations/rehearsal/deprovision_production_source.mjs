#!/usr/bin/env node
/**
 * Purpose: Remove the temporary production identities and local credential file used
 * by a completed Rehearsal refresh without changing the shared export boundary.
 * Run: `node scripts/operations/rehearsal/deprovision_production_source.mjs --dry-run`, then repeat with the
 * reported `--confirm-project=<project-ref>` after reviewing the exact scope.
 * Writes: Removes only the dedicated hosted DB login/scope, dedicated hosted Auth
 * identity, and ignored `.env.rehearsal-source.local`.
 */

import { execFileSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createCleanProcessEnvironment } from "../../lib/environment/runtime_environment.mjs";
import { buildRehearsalSourceDeprovisioningSql } from "../../lib/rehearsal/source_provisioning.mjs";

const repositoryRoot = resolve(new URL("../../..", import.meta.url).pathname);
const protectedEnvironmentPath = resolve(
	repositoryRoot,
	".env.moderation.local",
);
const sourceEnvironmentPath = resolve(
	repositoryRoot,
	".env.rehearsal-source.local",
);
const linkedProjectPath = resolve(repositoryRoot, "supabase/.temp/project-ref");
const sourceLoginRole = "rehearsal_source";
const storageEmail = "rehearsal-source-storage@blendcalc.local";
const storagePurpose = "production_source_storage_reader";
const confirmationPrefix = "--confirm-project=";
const allowedArguments = new Set(["--dry-run"]);

const readRequiredEnvironment = () => {
	const loaded = config({
		path: protectedEnvironmentPath,
		quiet: true,
		processEnv: {},
	});
	if (loaded.error) {
		throw new Error("Unable to read the protected moderation environment.");
	}
	const environment = loaded.parsed ?? {};
	const keys = [
		"PUBLIC_SUPABASE_URL",
		"SUPABASE_PROJECT_ID",
		"SUPABASE_SERVICE_ROLE_KEY",
	];
	const missing = keys.filter((key) => !environment[key]?.trim());
	if (missing.length) {
		throw new Error(
			`The protected moderation environment is missing: ${missing.join(", ")}.`,
		);
	}
	return environment;
};

const runLinkedSql = (sql) => {
	const output = execFileSync(
		"supabase",
		["db", "query", "--linked", "--output", "json", sql],
		{
			cwd: repositoryRoot,
			encoding: "utf8",
			env: createCleanProcessEnvironment(),
			maxBuffer: 8 * 1024 * 1024,
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	return JSON.parse(output);
};

const findStorageUser = async (adminClient) => {
	for (let page = 1; page <= 100; page += 1) {
		const { data, error } = await adminClient.auth.admin.listUsers({
			page,
			perPage: 200,
		});
		if (error) {
			throw new Error("Unable to inspect the Rehearsal Storage identity.");
		}
		const match = data.users.find(
			(user) => user.email?.toLowerCase() === storageEmail.toLowerCase(),
		);
		if (match) return match;
		if (data.users.length < 200) return undefined;
	}
	throw new Error(
		"The source Auth directory exceeded the bounded identity scan.",
	);
};

const assertDedicatedStorageUser = (storageUser) => {
	if (
		storageUser &&
		storageUser.app_metadata?.rehearsal_purpose !== storagePurpose
	) {
		throw new Error(
			"The reserved Rehearsal Storage email belongs to another identity.",
		);
	}
};

export const run = async () => {
	const rawArguments = process.argv.slice(2);
	const unknownArguments = rawArguments.filter(
		(argument) =>
			!allowedArguments.has(argument) &&
			!argument.startsWith(confirmationPrefix),
	);
	if (unknownArguments.length) {
		throw new Error(`Unsupported arguments: ${unknownArguments.join(", ")}.`);
	}
	const confirmations = rawArguments.filter((argument) =>
		argument.startsWith(confirmationPrefix),
	);
	if (confirmations.length > 1) {
		throw new Error("Provide exactly one --confirm-project value.");
	}

	const environment = readRequiredEnvironment();
	const linkedReference = await readFile(linkedProjectPath, "utf8").then(
		(value) => value.trim(),
	);
	if (environment.SUPABASE_PROJECT_ID !== linkedReference) {
		throw new Error("The protected and linked Supabase projects do not match.");
	}
	const storageUrl = new URL(environment.PUBLIC_SUPABASE_URL);
	if (storageUrl.hostname !== `${linkedReference}.supabase.co`) {
		throw new Error("The protected Supabase URL belongs to another project.");
	}

	const adminClient = createClient(
		environment.PUBLIC_SUPABASE_URL,
		environment.SUPABASE_SERVICE_ROLE_KEY,
		{
			auth: {
				autoRefreshToken: false,
				detectSessionInUrl: false,
				persistSession: false,
			},
		},
	);
	const storageUser = await findStorageUser(adminClient);
	assertDedicatedStorageUser(storageUser);

	const dryRun = rawArguments.includes("--dry-run");
	const confirmation = confirmations[0]?.slice(confirmationPrefix.length);
	if (dryRun) {
		console.log(
			`Rehearsal source deprovisioning is ready for project ${linkedReference}. It will remove only the ${sourceLoginRole} login and scope, the dedicated read-only Storage identity when present, and the ignored source credential file. The shared export views, active baseline, and local runtime remain unchanged. Repeat with --confirm-project=${linkedReference} to apply.`,
		);
		return;
	}
	if (confirmation !== linkedReference) {
		throw new Error(
			`Refusing production source deprovisioning. Run the dry run, then pass --confirm-project=${linkedReference}.`,
		);
	}

	runLinkedSql(
		buildRehearsalSourceDeprovisioningSql({ loginRole: sourceLoginRole }),
	);
	if (storageUser) {
		const { error } = await adminClient.auth.admin.deleteUser(storageUser.id);
		if (error) {
			throw new Error("Unable to remove the Rehearsal Storage identity.");
		}
	}
	const remainingStorageUser = await findStorageUser(adminClient);
	if (remainingStorageUser) {
		throw new Error("The Rehearsal Storage identity was not fully removed.");
	}
	await rm(sourceEnvironmentPath, { force: true });
	console.log(
		"Rehearsal production source deprovisioned. The active baseline and local runtime were preserved.",
	);
};

const isDirectExecution =
	process.argv[1] &&
	pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isDirectExecution) {
	run().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
