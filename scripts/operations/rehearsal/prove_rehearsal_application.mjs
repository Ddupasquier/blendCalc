/**
 * Purpose: Launch BlendCalc against the verified local Rehearsal runtime and prove
 * the application, CSP, isolated API route, and synthetic Auth exchange work together.
 * Run: `npm run rehearsal:app:prove`. It starts and stops only the local app process;
 * the isolated Rehearsal and blendCalcAPI database containers remain available.
 */

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { createCleanProcessEnvironment } from "../../lib/rehearsal/process_environment.mjs";
import { redactDiagnosticValue } from "../../lib/rehearsal/diagnostics.mjs";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const runtimeEnvironmentPath = join(repositoryRoot, ".rehearsal/runtime.env");
const applicationUrl = "http://localhost:5175";
const requiredVariables = [
	"PUBLIC_SUPABASE_URL",
	"PUBLIC_SUPABASE_PUBLISHABLE_KEY",
	"SUPABASE_SERVICE_ROLE_KEY",
	"BLENDCALC_REHEARSAL_ACCOUNT_EMAIL",
	"BLENDCALC_REHEARSAL_ACCOUNT_PASSWORD",
	"BLENDCALC_REHEARSAL_OWNER_PERSONA_ID",
];

const wait = (milliseconds) =>
	new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

const stopProcessGroup = async (child) => {
	if (child.exitCode !== null) return;
	try {
		process.kill(-child.pid, "SIGTERM");
	} catch (error) {
		if (error?.code !== "ESRCH") throw error;
	}
	await Promise.race([
		new Promise((resolveExit) => child.once("exit", resolveExit)),
		wait(5_000),
	]);
	if (child.exitCode === null) {
		try {
			process.kill(-child.pid, "SIGKILL");
		} catch (error) {
			if (error?.code !== "ESRCH") throw error;
		}
	}
};

const waitForApplication = async ({ output }) => {
	const deadline = Date.now() + 90_000;
	while (Date.now() < deadline) {
		try {
			const response = await fetch(applicationUrl, {
				headers: { accept: "text/html" },
				signal: AbortSignal.timeout(3_000),
			});
			if (response.ok) return response;
		} catch {
			// Vite and the two isolated Supabase stacks may still be starting.
		}
		await wait(500);
	}
	throw new Error(
		`BlendCalc Rehearsal did not become ready on localhost. Safe process output:\n${redactDiagnosticValue(output.value)}`,
	);
};

const main = async () => {
	const runtimeEnvironment = parse(
		await readFile(runtimeEnvironmentPath, "utf8"),
	);
	for (const key of requiredVariables) {
		if (!runtimeEnvironment[key]?.trim()) {
			throw new Error(
				`The verified Rehearsal runtime environment is missing ${key}.`,
			);
		}
	}
	for (const [label, value] of [
		["application", applicationUrl],
		["Supabase", runtimeEnvironment.PUBLIC_SUPABASE_URL],
	]) {
		if (!["127.0.0.1", "::1", "localhost"].includes(new URL(value).hostname)) {
			throw new Error(`${label} proof target is not loopback.`);
		}
	}

	const output = { value: "" };
	const child = spawn("npm", ["run", "dev:rehearsal"], {
		cwd: repositoryRoot,
		detached: true,
		env: createCleanProcessEnvironment(),
		stdio: ["ignore", "pipe", "pipe"],
	});
	for (const stream of [child.stdout, child.stderr]) {
		stream.setEncoding("utf8");
		stream.on("data", (chunk) => {
			output.value = `${output.value}${chunk}`.slice(-16_384);
		});
	}
	try {
		const homeResponse = await waitForApplication({ output });
		const html = await homeResponse.text();
		if (!/blendCalc/iu.test(html)) {
			throw new Error("The Rehearsal application response was not BlendCalc.");
		}
		const contentSecurityPolicy =
			homeResponse.headers.get("content-security-policy") ?? "";
		for (const source of ["http://127.0.0.1:58321", "http://127.0.0.1:55321"]) {
			if (!contentSecurityPolicy.includes(source)) {
				throw new Error(`Rehearsal CSP is missing ${source}.`);
			}
		}
		for (const forbidden of [
			"http://127.0.0.1:54321",
			"https://*.supabase.co",
		]) {
			if (contentSecurityPolicy.includes(forbidden)) {
				throw new Error(`Rehearsal CSP permits forbidden source ${forbidden}.`);
			}
		}

		const authResponse = await fetch(
			`${runtimeEnvironment.PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
			{
				method: "POST",
				headers: {
					apikey: runtimeEnvironment.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					email: runtimeEnvironment.BLENDCALC_REHEARSAL_ACCOUNT_EMAIL,
					password: runtimeEnvironment.BLENDCALC_REHEARSAL_ACCOUNT_PASSWORD,
				}),
				signal: AbortSignal.timeout(10_000),
			},
		);
		if (!authResponse.ok) {
			throw new Error(
				`Rehearsal owner-snapshot Auth exchange returned ${authResponse.status}.`,
			);
		}
		const authResult = await authResponse.json();
		if (
			!authResult.access_token ||
			authResult.user?.id !==
				runtimeEnvironment.BLENDCALC_REHEARSAL_OWNER_PERSONA_ID
		) {
			throw new Error(
				"Rehearsal owner-snapshot Auth exchange omitted the restored local identity.",
			);
		}
		const accessTokenParts = authResult.access_token.split(".");
		if (accessTokenParts.length !== 3) {
			throw new Error(
				"Rehearsal owner-snapshot Auth exchange returned an invalid access token.",
			);
		}
		let accessTokenClaims;
		try {
			accessTokenClaims = JSON.parse(
				Buffer.from(accessTokenParts[1], "base64url").toString("utf8"),
			);
		} catch {
			throw new Error(
				"Rehearsal owner-snapshot Auth exchange returned unreadable access-token claims.",
			);
		}
		if (accessTokenClaims.app_role !== "developer") {
			throw new Error(
				"Rehearsal owner-snapshot Auth exchange omitted the local developer role.",
			);
		}
		const ownerProfileResponse = await fetch(
			`${runtimeEnvironment.PUBLIC_SUPABASE_URL}/rest/v1/profiles?user_id=eq.${authResult.user.id}&select=user_id,display_name,bio,avatar_path`,
			{
				headers: {
					apikey: runtimeEnvironment.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
					authorization: `Bearer ${authResult.access_token}`,
				},
				signal: AbortSignal.timeout(10_000),
			},
		);
		const ownerProfiles = ownerProfileResponse.ok
			? await ownerProfileResponse.json()
			: [];
		if (
			ownerProfiles.length !== 1 ||
			ownerProfiles[0]?.user_id !== authResult.user.id ||
			!ownerProfiles[0]?.display_name
		) {
			throw new Error(
				"The Rehearsal owner session could not read its restored production-shaped profile.",
			);
		}

		const googleAuthorizeUrl = new URL(
			"/auth/v1/authorize",
			runtimeEnvironment.PUBLIC_SUPABASE_URL,
		);
		googleAuthorizeUrl.searchParams.set("provider", "google");
		googleAuthorizeUrl.searchParams.set(
			"redirect_to",
			`${applicationUrl}/auth/callback`,
		);
		const googleResponse = await fetch(googleAuthorizeUrl, {
			redirect: "manual",
			signal: AbortSignal.timeout(10_000),
		});
		const googleLocation = googleResponse.headers.get("location");
		if (!googleLocation || ![302, 303, 307].includes(googleResponse.status)) {
			throw new Error(
				`Local Google OAuth initiation returned ${googleResponse.status}.`,
			);
		}
		const providerUrl = new URL(googleLocation);
		if (providerUrl.hostname !== "accounts.google.com") {
			throw new Error(
				"Local Google OAuth did not route to Google's account chooser.",
			);
		}
		if (
			providerUrl.searchParams.get("redirect_uri") !==
			"http://127.0.0.1:58321/auth/v1/callback"
		) {
			throw new Error(
				"Local Google OAuth did not preserve the isolated Rehearsal callback.",
			);
		}
		if (!providerUrl.searchParams.get("client_id")) {
			throw new Error("Local Google OAuth omitted its dedicated client ID.");
		}

		const accountEmail = `rehearsal-auth-proof-${Date.now()}@blendcalc.local`;
		const accountResponse = await fetch(
			`${runtimeEnvironment.PUBLIC_SUPABASE_URL}/auth/v1/signup`,
			{
				method: "POST",
				headers: {
					apikey: runtimeEnvironment.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					email: accountEmail,
					password: "Rehearsal-account-proof-2026!",
					data: { display_name: "Rehearsal Account Proof" },
				}),
				signal: AbortSignal.timeout(10_000),
			},
		);
		if (!accountResponse.ok) {
			throw new Error(
				`Ordinary local Rehearsal account creation returned ${accountResponse.status}.`,
			);
		}
		const accountResult = await accountResponse.json();
		if (!accountResult.access_token || !accountResult.user?.id) {
			throw new Error(
				"Ordinary local Rehearsal account creation omitted its local session.",
			);
		}
		let accountProofError;
		try {
			const profileResponse = await fetch(
				`${runtimeEnvironment.PUBLIC_SUPABASE_URL}/rest/v1/profiles?user_id=eq.${accountResult.user.id}&select=user_id`,
				{
					headers: {
						apikey: runtimeEnvironment.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
						authorization: `Bearer ${accountResult.access_token}`,
					},
					signal: AbortSignal.timeout(10_000),
				},
			);
			const profiles = profileResponse.ok ? await profileResponse.json() : [];
			if (
				profiles.length !== 1 ||
				profiles[0]?.user_id !== accountResult.user.id
			) {
				throw new Error(
					"Ordinary local Rehearsal authentication did not create its local application profile.",
				);
			}
		} catch (error) {
			accountProofError = error;
		}
		const deleteResponse = await fetch(
			`${runtimeEnvironment.PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${accountResult.user.id}`,
			{
				method: "DELETE",
				headers: {
					apikey: runtimeEnvironment.SUPABASE_SERVICE_ROLE_KEY,
					authorization: `Bearer ${runtimeEnvironment.SUPABASE_SERVICE_ROLE_KEY}`,
				},
				signal: AbortSignal.timeout(10_000),
			},
		);
		if (!deleteResponse.ok) {
			throw new Error(
				"The disposable local authentication proof account could not be removed.",
			);
		}
		if (accountProofError) throw accountProofError;

		const apiResponse = await fetch(
			`${applicationUrl}/api/v1/products/09000000000209`,
			{ signal: AbortSignal.timeout(10_000) },
		);
		if (apiResponse.status >= 500) {
			throw new Error(
				`The isolated blendCalcAPI application route returned ${apiResponse.status}.`,
			);
		}

		console.log(
			"Verified the Rehearsal app, exact CSP isolation, restored owner profile and local developer claims, ordinary local account creation, local Google OAuth initiation, and local blendCalcAPI route.",
		);
	} finally {
		await stopProcessGroup(child);
	}
};

await main();
