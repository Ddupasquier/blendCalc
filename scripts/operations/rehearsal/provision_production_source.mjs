#!/usr/bin/env node
/**
 * Purpose: Provision and verify BlendCalc's two least-privilege production identities
 * used by Rehearsal, then atomically write their five-value ignored source environment.
 * Run: `npm run db:rehearsal:provision-source -- --dry-run`, then repeat with the
 * reported `--confirm-project=<project-ref>` after reviewing the exact scope.
 * Writes: One ephemeral hosted DB role/scope, one dedicated hosted Auth identity, and
 * ignored `.env.rehearsal-source.local` only.
 */

import { createHash, randomBytes } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { open, readFile, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createCleanProcessEnvironment } from "../../lib/environment/runtime_environment.mjs";
import {
	buildRehearsalSourceProvisioningSql,
	buildRehearsalStorageBindingSql,
	createRehearsalSourceDatabaseUrl,
	createRehearsalSourceEnvironment,
	selectRehearsalSourceOwner,
} from "../../lib/rehearsal/source_provisioning.mjs";
import { parseRehearsalSourceDatabaseUrl } from "../../lib/rehearsal/source_connection.mjs";
import { createRehearsalSourcePsqlInvocation } from "../../lib/rehearsal/postgres_client.mjs";

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
const linkedPoolerPath = resolve(repositoryRoot, "supabase/.temp/pooler-url");
const sourceLoginRole = "rehearsal_source";
const storageEmail = "rehearsal-source-storage@blendcalc.local";
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
		"PUBLIC_SUPABASE_PUBLISHABLE_KEY",
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

const runLinkedSql = async (sql) => {
	const temporaryPath = `${sourceEnvironmentPath}.sql-${process.pid}-${randomBytes(5).toString("hex")}`;
	const handle = await open(temporaryPath, "wx", 0o600);
	try {
		await handle.writeFile(sql, "utf8");
		await handle.sync();
		await handle.close();
		const output = execFileSync(
			"supabase",
			["db", "query", "--linked", "--file", temporaryPath, "--output", "json"],
			{
				cwd: repositoryRoot,
				encoding: "utf8",
				env: createCleanProcessEnvironment(),
				maxBuffer: 8 * 1024 * 1024,
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		return JSON.parse(output);
	} finally {
		await handle.close().catch(() => undefined);
		await rm(temporaryPath, { force: true });
	}
};

const findStorageUser = async (adminClient) => {
	for (let page = 1; page <= 100; page += 1) {
		const { data, error } = await adminClient.auth.admin.listUsers({
			page,
			perPage: 200,
		});
		if (error)
			throw new Error("Unable to inspect the source Storage identity.");
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

const writeSourceEnvironment = async (contents) => {
	const temporaryPath = `${sourceEnvironmentPath}.tmp-${process.pid}`;
	const handle = await open(temporaryPath, "w", 0o600);
	try {
		await handle.writeFile(contents, "utf8");
		await handle.sync();
	} finally {
		await handle.close();
	}
	await rename(temporaryPath, sourceEnvironmentPath);
};

const wait = (milliseconds) =>
	new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const assertDatabaseLogin = async ({ databaseUrl, expectedRole }) => {
	const parsed = parseRehearsalSourceDatabaseUrl(databaseUrl);
	const postgresClient = createRehearsalSourcePsqlInvocation(parsed);
	let result;
	for (let attempt = 1; attempt <= 8; attempt += 1) {
		result = spawnSync(
			postgresClient.command,
			[
				...postgresClient.args,
				"--quiet",
				"--no-align",
				"--tuples-only",
				"--set",
				"ON_ERROR_STOP=1",
				"--command",
				`select concat_ws('|', current_database(), current_user, session_user, current_setting('transaction_read_only'), (select count(*) from rehearsal_export.source_scope_v1));`,
			],
			{
				cwd: repositoryRoot,
				encoding: "utf8",
				env: postgresClient.environment,
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		if (result.status === 0) break;
		const retryable = String(result.stderr ?? "")
			.toLowerCase()
			.includes("password authentication failed");
		if (!retryable || attempt === 8) break;
		await wait(5_000);
	}
	if (!result || result.status !== 0) {
		const stderr = String(result?.stderr ?? "").toLowerCase();
		const failure = stderr.includes("password authentication failed")
			? "password authentication failed"
			: stderr.includes("tenant or user not found")
				? "the pooler did not recognize the custom login"
				: stderr.includes("could not translate host name")
					? "the pooler hostname did not resolve"
					: stderr.includes("timeout")
						? "the pooler connection timed out"
						: "the verification query was rejected";
		throw new Error(
			`The dedicated Rehearsal database login did not pass its live read-only preflight: ${failure}.`,
		);
	}
	if (
		result.stdout.trim() !== `postgres|${expectedRole}|${expectedRole}|on|1`
	) {
		throw new Error(
			`The dedicated Rehearsal database login returned an unexpected safe receipt: ${JSON.stringify(result.stdout.trim())}.`,
		);
	}
};

const issueStorageSession = async ({
	adminClient,
	storageUrl,
	publishableKey,
	ownerUserId,
}) => {
	const client = createClient(storageUrl, publishableKey, {
		auth: {
			autoRefreshToken: false,
			detectSessionInUrl: false,
			persistSession: false,
		},
	});
	const { data: generatedLink, error: linkError } =
		await adminClient.auth.admin.generateLink({
			type: "magiclink",
			email: storageEmail,
		});
	if (linkError || !generatedLink.properties?.hashed_token) {
		throw new Error(
			`The dedicated Rehearsal Storage session could not be issued (${linkError?.code ?? linkError?.name ?? "missing_token"}).`,
		);
	}
	const { data, error } = await client.auth.verifyOtp({
		type: "magiclink",
		token_hash: generatedLink.properties.hashed_token,
	});
	if (error || !data.session) {
		const category = error?.code ?? error?.name ?? "missing_session";
		throw new Error(
			`The dedicated Rehearsal Storage identity could not sign in (${category}).`,
		);
	}
	const payload = JSON.parse(
		Buffer.from(data.session.access_token.split(".")[1], "base64url").toString(
			"utf8",
		),
	);
	if (
		payload.role !== "rehearsal_storage_reader" ||
		payload.app_metadata?.rehearsal_owner_user_id !== ownerUserId
	) {
		throw new Error(
			"The dedicated Rehearsal Storage identity returned the wrong scope.",
		);
	}
	return Object.freeze({
		accessToken: data.session.access_token,
		refreshToken: data.session.refresh_token,
	});
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
	const [linkedReference, poolerUrl] = await Promise.all([
		readFile(linkedProjectPath, "utf8").then((value) => value.trim()),
		readFile(linkedPoolerPath, "utf8").then((value) => value.trim()),
	]);
	if (environment.SUPABASE_PROJECT_ID !== linkedReference) {
		throw new Error("The protected and linked Supabase projects do not match.");
	}
	const storageUrl = new URL(environment.PUBLIC_SUPABASE_URL);
	if (storageUrl.hostname !== `${linkedReference}.supabase.co`) {
		throw new Error("The protected Supabase URL belongs to another project.");
	}
	const dryRun = rawArguments.includes("--dry-run");
	const confirmation = confirmations[0]?.slice(confirmationPrefix.length);
	if (!dryRun && confirmation !== linkedReference) {
		throw new Error(
			`Refusing production provisioning. Run the dry run, then pass --confirm-project=${linkedReference}.`,
		);
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
	const { data: assignments, error: assignmentsError } = await adminClient
		.from("app_role_assignments")
		.select("user_id,role");
	if (assignmentsError) {
		throw new Error("Unable to inspect the approved Rehearsal source owner.");
	}
	const eligibleAssignments = assignments.filter((assignment) =>
		new Set(["admin", "developer"]).has(assignment.role),
	);
	const usersById = new Map();
	for (const assignment of eligibleAssignments) {
		const { data, error } = await adminClient.auth.admin.getUserById(
			assignment.user_id,
		);
		if (error || !data.user) {
			throw new Error("Unable to inspect an elevated source Auth identity.");
		}
		usersById.set(assignment.user_id, data.user);
	}
	const { user: owner } = selectRehearsalSourceOwner({
		assignments,
		usersById,
	});

	if (dryRun) {
		console.log(
			`Rehearsal source provisioning is ready for project ${linkedReference}. It will bind the one Google-linked admin/developer owner, create or rotate an ephemeral ${sourceLoginRole} credential that expires within 30 minutes, create or rotate one read-only Storage identity, and write the ignored owner-only source environment. Repeat with --confirm-project=${linkedReference} to apply.`,
		);
		return;
	}

	const databasePassword = randomBytes(32).toString("hex");
	const credentialValidUntil = new Date(
		Date.now() + 25 * 60 * 1000,
	).toISOString();
	const ownerEmailSha256 = createHash("sha256")
		.update(owner.email.trim().toLowerCase())
		.digest("hex");
	await runLinkedSql(
		buildRehearsalSourceProvisioningSql({
			loginRole: sourceLoginRole,
			databasePassword,
			credentialValidUntil,
			ownerUserId: owner.id,
			ownerEmailSha256,
		}),
	);

	let storageUser = await findStorageUser(adminClient);
	if (
		storageUser &&
		storageUser.app_metadata?.rehearsal_purpose !==
			"production_source_storage_reader"
	) {
		throw new Error(
			"The reserved Rehearsal Storage email belongs to another identity.",
		);
	}
	if (!storageUser) {
		const { data, error } = await adminClient.auth.admin.createUser({
			email: storageEmail,
			email_confirm: true,
			app_metadata: {
				rehearsal_purpose: "production_source_storage_reader",
				rehearsal_owner_user_id: owner.id,
			},
		});
		if (error || !data.user) {
			throw new Error("Unable to create the Rehearsal Storage identity.");
		}
		storageUser = data.user;
	} else {
		const { data, error } = await adminClient.auth.admin.updateUserById(
			storageUser.id,
			{
				app_metadata: {
					...storageUser.app_metadata,
					rehearsal_purpose: "production_source_storage_reader",
					rehearsal_owner_user_id: owner.id,
				},
			},
		);
		if (error || !data.user) {
			throw new Error("Unable to rotate the Rehearsal Storage identity.");
		}
		storageUser = data.user;
	}
	await runLinkedSql(
		buildRehearsalStorageBindingSql({
			storageUserId: storageUser.id,
			storageEmail,
			ownerUserId: owner.id,
		}),
	);

	const databaseUrl = createRehearsalSourceDatabaseUrl({
		poolerUrl,
		projectReference: linkedReference,
		loginRole: sourceLoginRole,
		databasePassword,
	});
	await assertDatabaseLogin({ databaseUrl, expectedRole: sourceLoginRole });
	const storageSession = await issueStorageSession({
		adminClient,
		storageUrl: environment.PUBLIC_SUPABASE_URL,
		publishableKey: environment.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
		ownerUserId: owner.id,
	});
	await writeSourceEnvironment(
		createRehearsalSourceEnvironment({
			databaseUrl,
			storageUrl: environment.PUBLIC_SUPABASE_URL,
			publishableKey: environment.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
			storageAccessToken: storageSession.accessToken,
			storageRefreshToken: storageSession.refreshToken,
		}),
	);
	console.log(
		"Rehearsal production source provisioned and independently verified. The ignored source environment is ready for refresh.",
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
