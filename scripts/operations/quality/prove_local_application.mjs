/**
 * Purpose: Prove BlendCalc's running isolated app, publication API, ordinary Auth,
 * CSP, signed images and expired-session recovery in Chromium, Firefox and WebKit.
 * Run: `node scripts/operations/quality/prove_local_application.mjs` with explicit local
 * service variables. The package starts the app; this test never launches services.
 * Creates and removes only its own synthetic local account and role. No hosted access.
 */

import { randomUUID } from "node:crypto";
import {
	combineChunks,
	createChunks,
	stringFromBase64URL,
	stringToBase64URL,
} from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { chromium, firefox, webkit, expect } from "@playwright/test";
import {
	assertLoadedLocalStorageImage,
	assertLocalContentSecurityPolicy,
} from "../../lib/security/local_application_proof.mjs";

const applicationUrl = "http://localhost:5175";
let stage = "local environment validation";
const requireProof = (condition) => {
	if (!condition) throw new Error("Application expectation failed.");
};
const requireResult = (result) => {
	requireProof(!result.error);
	return result.data;
};
const localService = (urlKey, keyName) => {
	const url = new URL(process.env[urlKey]);
	requireProof(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
	// Never use the ordinary development or QA stacks for this mutating proof.
	requireProof(
		["http:", "https:"].includes(url.protocol) &&
			!url.username &&
			!url.password,
	);
	requireProof(!["5173", "5174", "54321", "55321"].includes(url.port));
	requireProof(Boolean(process.env[keyName]));
	return createClient(url.origin, process.env[keyName], {
		auth: { persistSession: false, autoRefreshToken: false },
	});
};

const invalidateProofSession = async (context) => {
	const cookies = (await context.cookies(applicationUrl)).filter(({ name }) =>
		/-auth-token(?:\.\d+)?$/u.test(name),
	);
	requireProof(cookies.length > 0);
	const base = cookies[0].name.replace(/\.\d+$/u, "");
	const encoded = await combineChunks(
		base,
		async (name) =>
			cookies.find((cookie) => cookie.name === name)?.value ?? null,
	);
	requireProof(encoded?.startsWith("base64-"));
	const session = JSON.parse(stringFromBase64URL(encoded.slice(7)));
	requireProof(Boolean(session.access_token && session.refresh_token));
	// This is a synthetic rejected-session control, not evidence of natural JWT
	// expiry. Alter both the JWT expiry and the cookie expiry; changing only the
	// latter leaves a genuinely valid access token that Auth may correctly retain.
	const token = session.access_token.split(".");
	requireProof(token.length === 3);
	const claims = JSON.parse(Buffer.from(token[1], "base64url").toString());
	claims.exp = Math.floor(Date.now() / 1000) - 60;
	token[1] = Buffer.from(JSON.stringify(claims)).toString("base64url");
	session.access_token = token.join(".");
	session.expires_at = Math.floor(Date.now() / 1000) - 60;
	session.expires_in = 0;
	session.refresh_token = "application-proof-invalidated-refresh-token";
	const name = new RegExp(
		`^${base.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?:\\.\\d+)?$`,
		"u",
	);
	await context.clearCookies({ name });
	await context.addCookies(
		createChunks(
			base,
			`base64-${stringToBase64URL(JSON.stringify(session))}`,
		).map((chunk) => ({
			...chunk,
			url: applicationUrl,
			httpOnly: false,
			secure: false,
			sameSite: "Lax",
		})),
	);
	return name;
};

const main = async () => {
	requireProof(process.env.BLENDCALC_RUNTIME_ENVIRONMENT === "rehearsal");
	const admin = localService(
		"PUBLIC_SUPABASE_URL",
		"SUPABASE_SERVICE_ROLE_KEY",
	);
	const publication = localService(
		"BLENDCALC_API_SUPABASE_URL",
		"BLENDCALC_API_SUPABASE_SERVICE_ROLE_KEY",
	);
	requireProof(
		new URL(process.env.PUBLIC_SUPABASE_URL).origin !==
			new URL(process.env.BLENDCALC_API_SUPABASE_URL).origin,
	);
	const endpoints = {
		applicationSupabaseUrl: process.env.PUBLIC_SUPABASE_URL,
		blendCalcAPIUrl: process.env.BLENDCALC_API_SUPABASE_URL,
	};
	stage = "application readiness and CSP";
	const home = await fetch(applicationUrl, {
		signal: AbortSignal.timeout(10000),
	});
	requireProof(home.status === 200 && /blendcalc/iu.test(await home.text()));
	assertLocalContentSecurityPolicy(
		home.headers.get("content-security-policy"),
		endpoints,
	);

	stage = "published product corpus";
	const generations = requireResult(
		await publication
			.schema("blendcalc_api")
			.from("publication_generations")
			.select("id")
			.eq("status", "active")
			.single(),
	);
	const products = requireResult(
		await publication
			.schema("blendcalc_api")
			.from("publication_products")
			.select("gtin14,source_product_id,product_name")
			.eq("generation_id", generations.id)
			.order("gtin14")
			.limit(3),
	);
	requireProof(products.length === 3);
	const missingBarcode = "09999999999994";
	requireProof(
		requireResult(
			await publication
				.schema("blendcalc_api")
				.from("publication_products")
				.select("gtin14")
				.eq("generation_id", generations.id)
				.eq("gtin14", missingBarcode),
		).length === 0,
	);

	stage = "copied signed image lookup";
	const profiles = requireResult(
		await admin
			.from("profiles")
			.select("avatar_path")
			.not("avatar_path", "is", null)
			.limit(1),
	);
	const submissions = requireResult(
		await admin
			.from("shared_product_submissions")
			.select("evidence_paths")
			.eq("evidence_complete", true)
			.limit(25),
	);
	const evidence = submissions
		.flatMap((row) => Object.values(row.evidence_paths ?? {}))
		.find((value) => typeof value === "string" && value.trim());
	requireProof(Boolean(profiles[0]?.avatar_path && evidence));
	const imageUrls = [];
	for (const [bucket, path] of [
		["profile-avatars", profiles[0].avatar_path],
		["product-submission-evidence", evidence],
	]) {
		const signed = requireResult(
			await admin.storage.from(bucket).createSignedUrl(path, 600),
		);
		requireProof(
			new URL(signed.signedUrl).origin ===
				new URL(endpoints.applicationSupabaseUrl).origin,
		);
		const response = await fetch(signed.signedUrl, {
			signal: AbortSignal.timeout(10000),
		});
		requireProof(
			response.ok && response.headers.get("content-type")?.startsWith("image/"),
		);
		requireProof((await response.arrayBuffer()).byteLength > 0);
		imageUrls.push({ bucket, url: signed.signedUrl });
	}

	stage = "synthetic account creation";
	const email = `application-proof-${randomUUID()}@example.invalid`;
	const password = `Disposable-${randomUUID()}!`;
	const user = requireResult(
		await admin.auth.admin.createUser({ email, password, email_confirm: true }),
	).user;
	requireProof(Boolean(user?.id));
	let proofError;
	try {
		stage = "ordinary profile and database-backed role";
		requireProof(
			requireResult(
				await admin
					.from("profiles")
					.select("user_id")
					.eq("user_id", user.id)
					.single(),
			).user_id === user.id,
		);
		requireResult(
			await admin.rpc("set_app_user_role", {
				p_target_user_id: user.id,
				p_role: "developer",
				p_actor_user_id: null,
				p_reason_code: "local_application_proof",
			}),
		);
		const authenticated = createClient(
			process.env.PUBLIC_SUPABASE_URL,
			process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
			{ auth: { persistSession: false, autoRefreshToken: false } },
		);
		const session = requireResult(
			await authenticated.auth.signInWithPassword({ email, password }),
		).session;
		requireProof(
			JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url"))
				.app_role === "developer",
		);
		const refreshed = requireResult(
			await authenticated.auth.refreshSession(),
		).session;
		requireProof(Boolean(refreshed?.access_token));
		requireProof(
			JSON.parse(Buffer.from(refreshed.access_token.split(".")[1], "base64url"))
				.app_role === "developer",
		);
		const ownProfiles = requireResult(
			await authenticated.from("profiles").select("user_id"),
		);
		requireProof(
			ownProfiles.length === 1 && ownProfiles[0].user_id === user.id,
		);

		stage = "local Google initiation";
		const authorize = new URL(
			"/auth/v1/authorize",
			process.env.PUBLIC_SUPABASE_URL,
		);
		authorize.searchParams.set("provider", "google");
		authorize.searchParams.set(
			"redirect_to",
			`${applicationUrl}/auth/callback`,
		);
		authorize.searchParams.set("prompt", "select_account");
		const response = await fetch(authorize, {
			redirect: "manual",
			signal: AbortSignal.timeout(10000),
		});
		requireProof([302, 303, 307].includes(response.status));
		const provider = new URL(response.headers.get("location"));
		requireProof(
			provider.hostname === "accounts.google.com" &&
				provider.searchParams.get("prompt") === "select_account",
		);
		requireProof(
			provider.searchParams.get("redirect_uri") ===
				new URL("/auth/v1/callback", process.env.PUBLIC_SUPABASE_URL).href,
		);

		for (const [name, engine] of Object.entries({
			chromium,
			firefox,
			webkit,
		})) {
			stage = `${name} ordinary application workflow`;
			const browser = await engine.launch();
			try {
				const context = await browser.newContext({ baseURL: applicationUrl });
				let page = await context.newPage();
				const problems = [];
				const observe = (observedPage) => {
					observedPage.on("console", (message) => {
						if (["warning", "error"].includes(message.type()))
							problems.push(message.type());
					});
					observedPage.on("pageerror", () => problems.push("pageerror"));
				};
				observe(page);
				const navigate = async (path) => {
					await page.goto(path);
					await page.waitForFunction(
						() => document.documentElement.dataset.appReady === "true",
					);
				};
				requireProof(
					(
						await context.request.get(`/api/v1/products/${products[0].gtin14}`)
					).status() === 401,
				);
				const login = await context.request.post("/auth?/emailSignIn", {
					maxRedirects: 0,
					headers: { origin: applicationUrl },
					form: { email, password, next: "/profile" },
				});
				requireProof((await login.json()).type === "redirect");
				await navigate("/profile");
				await expect(
					page.getByRole("heading", { name: "Your profile" }),
				).toBeVisible();
				if (name === "chromium") {
					const dismiss = page.getByRole("button", {
						name: "Don’t show again",
						exact: true,
					});
					await expect(dismiss).toBeVisible();
					await dismiss.click();
					await expect(dismiss).toBeHidden();
				}
				for (const product of products) {
					const detail = await context.request.get(
						`/api/v1/products/${product.gtin14}`,
					);
					requireProof(
						detail.status() === 200 &&
							(await detail.json()).data.id === product.source_product_id,
					);
					const search = await context.request.get(
						`/api/v1/foods/search?q=${encodeURIComponent(product.product_name)}`,
					);
					requireProof(
						search.status() === 200 &&
							(await search.json()).data.some(
								(item) => item.id === product.source_product_id,
							),
					);
				}
				requireProof(
					(
						await context.request.get("/api/v1/products/not-a-barcode")
					).status() === 400,
				);
				requireProof(
					(
						await context.request.get(`/api/v1/products/${missingBarcode}`)
					).status() === 404,
				);
				await navigate("/profile/details");
				await page
					.getByLabel("Bio", { exact: true })
					.fill("Disposable application proof");
				await page
					.getByRole("button", { name: "Save profile", exact: true })
					.click();
				await expect
					.poll(
						async () =>
							requireResult(
								await admin
									.from("profiles")
									.select("bio")
									.eq("user_id", user.id)
									.single(),
							).bio,
					)
					.toBe("Disposable application proof");
				await navigate("/profile");
				await page.reload();
				await page.waitForFunction(
					() => document.documentElement.dataset.appReady === "true",
				);
				await expect(
					page.locator(".profile-identity-summary__copy p"),
				).toHaveText("Disposable application proof");
				stage = `${name} signed image rendering`;
				for (const image of imageUrls) {
					await page.evaluate(
						(url) =>
							new Promise((resolve, reject) => {
								const element = new Image();
								element.alt = "Application image proof";
								element.onload = () => {
									document.body.append(element);
									resolve();
								};
								element.onerror = () =>
									reject(new Error("Image did not load."));
								element.src = url;
							}),
						image.url,
					);
					const images = await page.locator("img").evaluateAll((elements) =>
						elements.map((image) => {
							const url = new URL(image.currentSrc || image.src);
							return {
								origin: url.origin,
								pathname: url.pathname,
								complete: image.complete,
								naturalWidth: image.naturalWidth,
								naturalHeight: image.naturalHeight,
							};
						}),
					);
					assertLoadedLocalStorageImage(images, {
						...endpoints,
						bucket: image.bucket,
					});
				}
				stage = `${name} AAL1 privileged-page redirect`;
				const privileged = await context.request.get(
					"/profile/privileged-tools",
					{ maxRedirects: 0 },
				);
				requireProof(
					privileged.status() === 303 &&
						privileged.headers().location?.startsWith("/auth/mfa"),
				);
				// Stop the authenticated client before replacing its cookies: a live
				// client retains its valid in-memory session and may refresh them.
				await page.close();
				const authName = await invalidateProofSession(context);
				page = await context.newPage();
				observe(page);
				for (let attempt = 0; attempt < 2; attempt++) {
					stage = `${name} expired-session recovery ${attempt + 1}`;
					const response = await page.goto("/profile/privileged-tools", {
						waitUntil: "domcontentloaded",
					});
					const returnedUrl = new URL(page.url());
					const returnedPath = returnedUrl.pathname;
					stage += ` (HTTP ${response?.status() ?? "none"}; ${returnedUrl.origin === applicationUrl ? "local" : "not application origin"})`;
					stage += /^\/[a-z/-]{0,100}$/u.test(returnedPath)
						? ` (returned ${returnedPath})`
						: " (returned another route)";
					// Root layout redirects signed-out visitors to /; the profile
					// layout also guards its subtree through /auth. Both are public
					// entry pages, never an authenticated or privileged destination.
					await expect(page).toHaveURL(
						(url) =>
							url.origin === applicationUrl &&
							["/", "/auth"].includes(url.pathname),
					);
					await page.waitForFunction(
						() => document.documentElement.dataset.appReady === "true",
					);
					requireProof(
						!new URL(page.url()).pathname.startsWith(
							"/profile/privileged-tools",
						),
					);
					requireProof(
						!(await page.locator("body").innerText()).includes(
							"refresh_token_not_found",
						),
					);
					requireProof(
						(
							await context.request.get(
								`/api/v1/products/${products[0].gtin14}`,
							)
						).status() === 401,
					);
				}
				stage = `${name} expired-session cookie cleanup`;
				requireProof(
					!(await context.cookies(applicationUrl)).some((cookie) =>
						authName.test(cookie.name),
					),
				);
				stage = `${name} browser console (${problems.length} warning/error events)`;
				requireProof(problems.length === 0);
				await context.close();
				console.log(
					`${name}: Auth, refresh, role/RLS/MFA, three publication products/searches, negative controls, save/reload, two signed images and expired-session recovery passed.`,
				);
			} finally {
				await browser.close();
			}
		}
	} catch (error) {
		proofError = error;
	} finally {
		try {
			const cleanup = await admin.auth.admin.deleteUser(user.id);
			if (cleanup.error) {
				stage += "; synthetic account cleanup failed";
				proofError ??= new Error("Could not remove the proof account.");
			}
		} catch {
			stage += "; synthetic account cleanup request failed";
			proofError ??= new Error("Could not remove the proof account.");
		}
	}
	if (proofError) throw proofError;
};

await main().catch((error) => {
	// Do not print SDK responses, browser assertions, signed URLs, row values or tokens.
	const category =
		error?.name === "TimeoutError"
			? "browser timeout"
			: /interrupted.*navigation/iu.test(error?.message ?? "")
				? "competing browser navigation"
				: /ERR_ABORTED|NS_BINDING_ABORTED/iu.test(error?.message ?? "")
					? "aborted browser navigation"
					: "expectation failed";
	console.error(`Local application proof failed at ${stage} (${category}).`);
	process.exitCode = 1;
});
