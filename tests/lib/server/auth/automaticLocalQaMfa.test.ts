import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	mkdtemp,
	readFile,
	rm,
	stat,
	writeFile,
	chmod,
	symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import { completeAutomaticLocalQaMfa } from "$lib/server/auth/automaticLocalQaMfa.server";
import { createCurrentAuthenticatorVerificationCode } from "$lib/server/auth/authenticatorVerificationCode.server";

const mocks = vi.hoisted(() => ({ wait: vi.fn() }));
vi.mock("node:timers/promises", () => ({ setTimeout: mocks.wait }));

const userId = "99999000-0000-4000-8000-000000000001";
const factorId = "99999000-0000-4000-8000-000000000002";
const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const manualFactor = {
	id: "manual-factor",
	factor_type: "totp",
	status: "verified",
	friendly_name: "My authenticator",
};
const account = {
	key: "developer",
	role: "developer",
	email: "qa-developer@blendcalc.local",
	displayName: "QA Developer",
	purpose: "Local tools",
};
const runtime = {
	appUrl: new URL("http://localhost:5174/auth"),
	runtimeEnvironment: "test",
	supabaseUrl: "http://127.0.0.1:54321",
	password: "local-test-password",
	accountsBase64: Buffer.from(JSON.stringify([account])).toString("base64"),
};

const makeClient = () => {
	const user = { id: userId, email: account.email, factors: [manualFactor] };
	const auth = {
		getUser: vi.fn(async () => ({ data: { user }, error: null })),
		getClaims: vi.fn(async () => ({
			data: { claims: { sub: userId, aal: "aal2" } },
			error: null,
		})),
		mfa: {
			enroll: vi.fn(async () => {
				user.factors.push({
					id: factorId,
					factor_type: "totp",
					status: "unverified",
					friendly_name: "BlendCalc automatic local QA",
				});
				return { data: { id: factorId, totp: { secret } }, error: null };
			}),
			challengeAndVerify: vi.fn(async () => ({ error: null })),
			unenroll: vi.fn(async () => ({ error: null })),
		},
	};
	return {
		auth,
		supabase: { auth } as unknown as SupabaseClient<Database>,
		user,
	};
};

describe("automatic local QA MFA", () => {
	let cacheDirectory: string;
	beforeEach(async () => {
		cacheDirectory = await mkdtemp(resolve(tmpdir(), "blendcalc-qa-mfa-"));
		mocks.wait.mockReset();
		mocks.wait.mockImplementation(async (milliseconds: number) => {
			vi.setSystemTime(Date.now() + milliseconds);
		});
	});
	afterEach(async () => {
		vi.useRealTimers();
		await rm(cacheDirectory, { recursive: true, force: true });
	});
	const run = (client: ReturnType<typeof makeClient>, input = runtime) =>
		completeAutomaticLocalQaMfa({
			supabase: client.supabase,
			accountKey: "developer",
			runtime: input,
			cacheDirectory,
		});

	it("uses real Auth verification, keeps manual factors, and stores the secret privately", async () => {
		const client = makeClient();
		await run(client);
		expect(client.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({
			factorId,
			code: expect.stringMatching(/^\d{6}$/u),
		});
		expect(client.auth.getClaims).toHaveBeenCalledOnce();
		expect(client.auth.mfa.unenroll).not.toHaveBeenCalled();
		expect(client.user.factors).toContain(manualFactor);
		expect(
			(await stat(resolve(cacheDirectory, `${userId}.json`))).mode & 0o777,
		).toBe(0o600);
	});

	it.each([
		["5173", { appUrl: new URL("http://localhost:5173/auth") }],
		[
			"5175",
			{
				appUrl: new URL("http://localhost:5175/auth"),
				runtimeEnvironment: "rehearsal",
			},
		],
		["hosted app", { appUrl: new URL("https://www.blendcalc.food/auth") }],
		["hosted database", { supabaseUrl: "https://example.supabase.co" }],
		["missing credentials", { password: "" }],
		["production mode", { runtimeEnvironment: "production" }],
	])("does nothing in %s", async (_label, overrides) => {
		const client = makeClient();
		await run(client, { ...runtime, ...overrides });
		expect(client.auth.getUser).not.toHaveBeenCalled();
	});

	it("does not elevate ordinary accounts or accept a mismatched verified user", async () => {
		const client = makeClient();
		await completeAutomaticLocalQaMfa({
			supabase: client.supabase,
			accountKey: "user",
			runtime,
			cacheDirectory,
		});
		expect(client.auth.getUser).not.toHaveBeenCalled();
		client.user.email = "different@blendcalc.local";
		await expect(run(client)).rejects.toThrow(
			"Automatic local verification failed",
		);
		expect(client.auth.mfa.enroll).not.toHaveBeenCalled();
	});

	it("reuses the factor across restart and waits rather than reusing a code", async () => {
		const client = makeClient();
		vi.useFakeTimers();
		vi.setSystemTime(60_000);
		await run(client);
		await run(client);
		expect(mocks.wait).toHaveBeenCalledWith(31_000);
		expect(client.auth.mfa.enroll).toHaveBeenCalledOnce();
		expect(client.auth.mfa.challengeAndVerify).toHaveBeenCalledTimes(2);
		expect(client.auth.mfa.challengeAndVerify.mock.calls[0]).not.toEqual(
			client.auth.mfa.challengeAndVerify.mock.calls[1],
		);
	});

	it("recreates only a missing automatic factor after a database reset", async () => {
		const client = makeClient();
		await run(client);
		client.user.factors = [manualFactor];
		await run(client);
		expect(client.auth.mfa.enroll).toHaveBeenCalledTimes(2);
		expect(client.auth.mfa.unenroll).not.toHaveBeenCalled();
	});

	it("serializes overlapping logins instead of replaying one verification code", async () => {
		const client = makeClient();
		vi.useFakeTimers();
		vi.setSystemTime(60_000);
		let releaseVerification = () => {};
		const firstVerificationStarted = new Promise<void>((resolveStarted) => {
			client.auth.mfa.challengeAndVerify.mockImplementationOnce(async () => {
				resolveStarted();
				await new Promise<void>((resolveVerification) => {
					releaseVerification = resolveVerification;
				});
				return { error: null };
			});
		});
		const first = run(client);
		await firstVerificationStarted;
		const second = run(client);
		await Promise.resolve();
		await Promise.resolve();
		expect(client.auth.mfa.challengeAndVerify).toHaveBeenCalledOnce();
		releaseVerification();
		await Promise.all([first, second]);
		expect(client.auth.mfa.enroll).toHaveBeenCalledOnce();
		expect(client.auth.mfa.challengeAndVerify).toHaveBeenCalledTimes(2);
		expect(client.auth.mfa.challengeAndVerify.mock.calls[0]).not.toEqual(
			client.auth.mfa.challengeAndVerify.mock.calls[1],
		);
	});

	it("rejects a provider refusal or a signed session that is still AAL1", async () => {
		const client = makeClient();
		client.auth.mfa.challengeAndVerify.mockResolvedValueOnce({
			error: { message: secret },
		} as never);
		await expect(run(client)).rejects.toThrow(
			"Automatic local verification failed",
		);
		expect(client.auth.getClaims).not.toHaveBeenCalled();
		client.auth.getClaims.mockResolvedValueOnce({
			data: { claims: { sub: userId, aal: "aal1" } },
			error: null,
		});
		await expect(run(client)).rejects.toThrow(
			"Automatic local verification failed",
		);
	});

	it("fails closed on oversized, exposed, corrupt, or symlinked private state", async () => {
		const client = makeClient();
		const path = resolve(cacheDirectory, `${userId}.json`);
		for (const content of ["x".repeat(4097), "not json"]) {
			await writeFile(path, content, { mode: 0o600 });
			await expect(run(client)).rejects.toThrow(
				"Automatic local verification failed",
			);
		}
		await chmod(path, 0o644);
		await expect(run(client)).rejects.toThrow(
			"Automatic local verification failed",
		);
		await rm(path);
		await symlink(resolve(cacheDirectory, "missing.json"), path);
		await expect(run(client)).rejects.toThrow(
			"Automatic local verification failed",
		);
		expect(client.auth.mfa.enroll).not.toHaveBeenCalled();
	});

	it("stores only a bounded account-specific record", async () => {
		await run(makeClient());
		const value = JSON.parse(
			await readFile(resolve(cacheDirectory, `${userId}.json`), "utf8"),
		);
		expect(Object.keys(value).sort()).toEqual([
			"factorId",
			"lastVerifiedStep",
			"secret",
			"userId",
		]);
	});

	it("matches RFC 6238 reference codes and rejects malformed keys", () => {
		expect(createCurrentAuthenticatorVerificationCode(secret, 59_000)).toBe(
			"287082",
		);
		expect(
			createCurrentAuthenticatorVerificationCode(secret, 1_111_111_109_000),
		).toBe("081804");
		expect(() =>
			createCurrentAuthenticatorVerificationCode("malformed key"),
		).toThrow();
	});
});
