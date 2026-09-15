/**
 * Purpose: Launch BlendCalc against the verified local Rehearsal runtime and prove its
 * project-specific application, CSP, isolated API route, and synthetic Auth exchange.
 * Run: `npm run rehearsal:app:prove`. It starts and stops only the local app process;
 * the isolated Rehearsal and blendCalcAPI database containers remain available.
 */

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	combineChunks,
	createChunks,
	stringFromBase64URL,
	stringToBase64URL,
} from "@supabase/ssr";
import { chromium } from "playwright";
import { parse } from "dotenv";
import { redactDiagnosticValue } from "@rehearsal-db/core/diagnostics";
import { createCleanProcessEnvironment } from "@rehearsal-db/core/process-environment";
import {
	assertLoadedRehearsalStorageImage,
	assertRehearsalContentSecurityPolicy,
} from "../../lib/rehearsal/application_proof.mjs";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const runtimeEnvironmentPath = join(repositoryRoot, ".rehearsal/runtime.env");
const applicationUrl = "http://localhost:5175";
const blendCalcAPISupabaseUrl = "http://127.0.0.1:55321";
const authCookieNamePattern = /-auth-token(?:\.\d+)?$/u;
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

const countRefreshTokenFailures = (output) =>
	output.match(/refresh_token_not_found/gu)?.length ?? 0;

const readRenderedImages = (page) =>
	page.locator("img").evaluateAll((images) =>
		images.map((image) => {
			const url = new URL(image.currentSrc || image.src, window.location.href);
			return {
				origin: url.origin,
				pathname: url.pathname,
				complete: image.complete,
				naturalWidth: image.naturalWidth,
				naturalHeight: image.naturalHeight,
			};
		}),
	);

const encodeStorageObjectPath = (path) =>
	path.split("/").map(encodeURIComponent).join("/");

const createSignedSubmissionEvidenceUrl = async ({
	applicationSupabaseUrl,
	serviceRoleKey,
}) => {
	const submissionsResponse = await fetch(
		`${applicationSupabaseUrl}/rest/v1/shared_product_submissions?select=evidence_paths&evidence_complete=eq.true&limit=25`,
		{
			headers: {
				apikey: serviceRoleKey,
				authorization: `Bearer ${serviceRoleKey}`,
			},
			signal: AbortSignal.timeout(10_000),
		},
	);
	if (!submissionsResponse.ok) {
		throw new Error(
			`Rehearsal submission-evidence lookup returned ${submissionsResponse.status}.`,
		);
	}
	const submissions = await submissionsResponse.json();
	const evidencePath = submissions
		.flatMap((submission) => Object.values(submission.evidence_paths ?? {}))
		.find((value) => typeof value === "string" && value.trim());
	if (!evidencePath) {
		throw new Error(
			"The active Rehearsal baseline has no submission-evidence image to prove.",
		);
	}

	const signedResponse = await fetch(
		`${applicationSupabaseUrl}/storage/v1/object/sign/product-submission-evidence/${encodeStorageObjectPath(evidencePath)}`,
		{
			method: "POST",
			headers: {
				apikey: serviceRoleKey,
				authorization: `Bearer ${serviceRoleKey}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ expiresIn: 60 }),
			signal: AbortSignal.timeout(10_000),
		},
	);
	if (!signedResponse.ok) {
		throw new Error(
			`Rehearsal submission-evidence signing returned ${signedResponse.status}.`,
		);
	}
	const signed = await signedResponse.json();
	if (typeof signed.signedURL !== "string" || !signed.signedURL) {
		throw new Error("Rehearsal Storage omitted the signed evidence URL.");
	}
	const signedPath = signed.signedURL.startsWith("/storage/")
		? signed.signedURL
		: `/storage/v1${signed.signedURL.startsWith("/") ? "" : "/"}${signed.signedURL}`;
	return new URL(signedPath, applicationSupabaseUrl).toString();
};

const replaceBrowserSessionWithExpiredResetSession = async (context) => {
	const cookies = await context.cookies(applicationUrl);
	const authCookies = cookies.filter(({ name }) =>
		authCookieNamePattern.test(name),
	);
	if (authCookies.length === 0) {
		throw new Error("Rehearsal browser proof did not receive an Auth cookie.");
	}
	const baseName = authCookies[0].name.replace(/\.\d+$/u, "");
	const encodedSession = await combineChunks(
		baseName,
		async (name) =>
			authCookies.find((cookie) => cookie.name === name)?.value ?? null,
	);
	if (!encodedSession?.startsWith("base64-")) {
		throw new Error("Rehearsal Auth cookie did not use the expected encoding.");
	}
	const session = JSON.parse(stringFromBase64URL(encodedSession.slice(7)));
	if (!session?.access_token || !session?.refresh_token) {
		throw new Error("Rehearsal Auth cookie omitted its session tokens.");
	}
	session.expires_at = Math.floor(Date.now() / 1_000) - 60;
	session.expires_in = 0;
	session.refresh_token = "rehearsal-reset-invalidated-refresh-token";

	const replacementChunks = createChunks(
		baseName,
		`base64-${stringToBase64URL(JSON.stringify(session))}`,
	);
	await context.clearCookies({
		name: new RegExp(
			`^${baseName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?:\\.\\d+)?$`,
			"u",
		),
	});
	await context.addCookies(
		replacementChunks.map(({ name, value }) => ({
			name,
			value,
			url: applicationUrl,
			httpOnly: false,
			secure: false,
			sameSite: "Lax",
		})),
	);
	return baseName;
};

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

const waitForRehearsalLaunch = async ({ output, child }) => {
	const deadline = Date.now() + 90_000;
	while (Date.now() < deadline) {
		if (
			output.value.includes("Starting BlendCalc REHEARSAL on localhost:5175")
		) {
			return;
		}
		if (child.exitCode !== null) {
			throw new Error(
				`BlendCalc Rehearsal exited before its launcher became ready. Safe process output:\n${redactDiagnosticValue(output.value)}`,
			);
		}
		await wait(100);
	}
	throw new Error(
		`BlendCalc Rehearsal launcher did not become ready. Safe process output:\n${redactDiagnosticValue(output.value)}`,
	);
};

const waitForApplication = async ({ output, child, runtimeEnvironment }) => {
	const deadline = Date.now() + 90_000;
	let lastReadinessError = null;
	while (Date.now() < deadline) {
		if (child.exitCode !== null) {
			throw new Error(
				`BlendCalc Rehearsal exited before becoming ready. Safe process output:\n${redactDiagnosticValue(output.value)}`,
			);
		}
		try {
			const response = await fetch(applicationUrl, {
				headers: { accept: "text/html" },
				signal: AbortSignal.timeout(3_000),
			});
			if (response.ok) {
				assertRehearsalContentSecurityPolicy(
					response.headers.get("content-security-policy") ?? "",
					{
						applicationSupabaseUrl: runtimeEnvironment.PUBLIC_SUPABASE_URL,
						blendCalcAPIUrl: blendCalcAPISupabaseUrl,
					},
				);
				return response;
			}
		} catch (error) {
			lastReadinessError = error;
			// Vite and the two isolated Supabase stacks may still be starting.
		}
		await wait(500);
	}
	throw new Error(
		`BlendCalc Rehearsal did not become ready on localhost${lastReadinessError instanceof Error ? `: ${lastReadinessError.message}` : "."} Safe process output:\n${redactDiagnosticValue(output.value)}`,
	);
};

const proveBrowserStorageAndResetSession = async ({
	runtimeEnvironment,
	output,
}) => {
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext();
	const page = await context.newPage();
	const browserProblems = [];
	page.on("console", (message) => {
		if (["warning", "error"].includes(message.type())) {
			browserProblems.push(message.type());
		}
	});
	page.on("pageerror", () => browserProblems.push("pageerror"));

	try {
		await page.goto(`${applicationUrl}/auth?next=%2Fprofile`, {
			waitUntil: "domcontentloaded",
		});
		await page
			.getByRole("button", { name: "Continue as Owner snapshot" })
			.click();
		await page.waitForURL((url) => new URL(url).pathname === "/profile", {
			timeout: 30_000,
		});
		await page.waitForFunction(
			(expectedOrigin) =>
				[...document.images].some((image) => {
					const url = new URL(
						image.currentSrc || image.src,
						window.location.href,
					);
					return (
						url.origin === expectedOrigin &&
						url.pathname.includes("/storage/v1/object/sign/profile-avatars/") &&
						image.complete &&
						image.naturalWidth > 0 &&
						image.naturalHeight > 0
					);
				}),
			new URL(runtimeEnvironment.PUBLIC_SUPABASE_URL).origin,
			{ timeout: 15_000 },
		);
		assertLoadedRehearsalStorageImage(await readRenderedImages(page), {
			applicationSupabaseUrl: runtimeEnvironment.PUBLIC_SUPABASE_URL,
			bucket: "profile-avatars",
		});

		const evidenceUrl = await createSignedSubmissionEvidenceUrl({
			applicationSupabaseUrl: runtimeEnvironment.PUBLIC_SUPABASE_URL,
			serviceRoleKey: runtimeEnvironment.SUPABASE_SERVICE_ROLE_KEY,
		});
		await page.evaluate(
			(url) =>
				new Promise((resolve, reject) => {
					const image = new Image();
					image.alt = "Rehearsal submission evidence proof";
					image.hidden = true;
					image.addEventListener("load", () => {
						document.body.append(image);
						resolve(undefined);
					});
					image.addEventListener("error", () =>
						reject(new Error("Submission evidence image failed to load.")),
					);
					image.src = url;
				}),
			evidenceUrl,
		);
		assertLoadedRehearsalStorageImage(await readRenderedImages(page), {
			applicationSupabaseUrl: runtimeEnvironment.PUBLIC_SUPABASE_URL,
			bucket: "product-submission-evidence",
		});

		const authCookieBaseName =
			await replaceBrowserSessionWithExpiredResetSession(context);
		const failuresBeforeRecovery = countRefreshTokenFailures(output.value);
		await page.goto(`${applicationUrl}/profile/privileged-tools`, {
			waitUntil: "domcontentloaded",
		});
		if (new URL(page.url()).pathname.startsWith("/profile/privileged-tools")) {
			throw new Error(
				"A reset-invalidated Rehearsal session retained privileged access.",
			);
		}
		if (
			(await page.locator("body").innerText()).includes(
				"refresh_token_not_found",
			)
		) {
			throw new Error(
				"Rehearsal exposed its reset-invalidated refresh token error in the page.",
			);
		}
		const failuresAfterFirstRecovery = countRefreshTokenFailures(output.value);
		await page.goto(`${applicationUrl}/profile/privileged-tools`, {
			waitUntil: "domcontentloaded",
		});
		await wait(250);
		const failuresAfterSecondRecovery = countRefreshTokenFailures(output.value);
		if (failuresAfterSecondRecovery !== failuresAfterFirstRecovery) {
			throw new Error(
				"Rehearsal retried a reset-invalidated refresh token after clearing the session.",
			);
		}
		if (failuresAfterFirstRecovery - failuresBeforeRecovery > 2) {
			throw new Error(
				"Rehearsal made an unbounded reset-session refresh attempt.",
			);
		}
		const remainingAuthCookies = (await context.cookies(applicationUrl)).filter(
			({ name }) =>
				new RegExp(
					`^${authCookieBaseName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?:\\.\\d+)?$`,
					"u",
				).test(name),
		);
		if (remainingAuthCookies.length > 0) {
			throw new Error(
				"Rehearsal retained the reset-invalidated browser Auth cookie.",
			);
		}
		if (browserProblems.length > 0) {
			throw new Error(
				`Rehearsal browser proof observed ${browserProblems.length} warning or error event(s).`,
			);
		}
	} finally {
		await context.close();
		await browser.close();
	}
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
		await waitForRehearsalLaunch({ output, child });
		const homeResponse = await waitForApplication({
			output,
			child,
			runtimeEnvironment,
		});
		const html = await homeResponse.text();
		if (!/blendCalc/iu.test(html)) {
			throw new Error("The Rehearsal application response was not BlendCalc.");
		}
		const contentSecurityPolicy =
			homeResponse.headers.get("content-security-policy") ?? "";
		assertRehearsalContentSecurityPolicy(contentSecurityPolicy, {
			applicationSupabaseUrl: runtimeEnvironment.PUBLIC_SUPABASE_URL,
			blendCalcAPIUrl: blendCalcAPISupabaseUrl,
		});

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

		await proveBrowserStorageAndResetSession({
			runtimeEnvironment,
			output,
		});

		console.log(
			"Verified the Rehearsal app, directive-level CSP isolation, restored owner profile and Storage images, reset-session recovery, local developer claims, ordinary local account creation, local Google OAuth initiation, and local blendCalcAPI route.",
		);
	} finally {
		await stopProcessGroup(child);
	}
};

await main();
