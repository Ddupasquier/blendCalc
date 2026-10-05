import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import {
	getAutomaticLocalQaMfaAccount,
	type LocalQaRuntimeInput,
} from "./localQaSignIn.server";
import { createCurrentAuthenticatorVerificationCode } from "./authenticatorVerificationCode.server";
import { constants } from "node:fs";
import { lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";

const FACTOR_NAME = "BlendCalc automatic local QA";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const pendingAccounts = new Map<string, Promise<void>>();

type QaAuthenticator = {
	userId: string;
	factorId: string;
	secret: string;
	lastVerifiedStep: number;
};

const readAuthenticator = async (
	path: string,
): Promise<QaAuthenticator | null> => {
	let file;
	try {
		file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
	try {
		const stat = await file.stat();
		if (!stat.isFile() || stat.size > 4096 || (stat.mode & 0o077) !== 0) {
			throw new Error("Unsafe local authenticator state.");
		}
		const value = JSON.parse(await file.readFile("utf8")) as QaAuthenticator;
		if (
			!UUID.test(value.userId) ||
			!UUID.test(value.factorId) ||
			!/^[A-Z2-7]{16,128}$/u.test(value.secret) ||
			!Number.isSafeInteger(value.lastVerifiedStep) ||
			value.lastVerifiedStep < -1
		)
			throw new Error("Invalid local authenticator state.");
		return value;
	} finally {
		await file.close();
	}
};

const saveAuthenticator = async (path: string, value: QaAuthenticator) => {
	const temporaryPath = `${path}.${randomUUID()}.tmp`;
	const file = await open(temporaryPath, "wx", 0o600);
	try {
		await file.writeFile(JSON.stringify(value));
		await file.close();
		await rename(temporaryPath, path);
	} finally {
		await file.close();
		await unlink(temporaryPath).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		});
	}
};

const verifyAccount = async (
	supabase: SupabaseClient<Database>,
	userId: string,
	cacheDirectory: string,
) => {
	await mkdir(cacheDirectory, { recursive: true, mode: 0o700 });
	const directory = await lstat(cacheDirectory);
	if (
		!directory.isDirectory() ||
		directory.isSymbolicLink() ||
		(directory.mode & 0o077) !== 0
	) {
		throw new Error("Unsafe local authenticator directory.");
	}
	const path = resolve(cacheDirectory, `${userId}.json`);
	let authenticator = await readAuthenticator(path);
	const { data, error } = await supabase.auth.getUser();
	if (error || data.user?.id !== userId)
		throw new Error("Local identity changed.");
	const factors = data.user.factors ?? [];
	if (authenticator && authenticator.userId !== userId)
		throw new Error("Local identity mismatch.");
	const cachedFactor = factors.find(({ id }) => id === authenticator?.factorId);
	if (
		cachedFactor &&
		(cachedFactor.factor_type !== "totp" ||
			cachedFactor.friendly_name !== FACTOR_NAME)
	) {
		throw new Error("Local authenticator mismatch.");
	}
	if (!cachedFactor) {
		// Never remove or repurpose a manually enrolled authenticator.
		const enrollment = await supabase.auth.mfa.enroll({
			factorType: "totp",
			friendlyName: FACTOR_NAME,
			issuer: "blendCalc QA",
		});
		if (enrollment.error || !enrollment.data)
			throw new Error("Local enrollment failed.");
		authenticator = {
			userId,
			factorId: enrollment.data.id,
			secret: enrollment.data.totp.secret,
			lastVerifiedStep: -1,
		};
		try {
			await saveAuthenticator(path, authenticator);
		} catch {
			await supabase.auth.mfa.unenroll({ factorId: authenticator.factorId });
			throw new Error("Local enrollment could not be saved.");
		}
	}
	if (!authenticator) throw new Error("Local authenticator unavailable.");
	// Keep provider replay protection: repeated login waits for a fresh code.
	if (authenticator.lastVerifiedStep >= Math.floor(Date.now() / 30_000)) {
		await setTimeout(30_000 - (Date.now() % 30_000) + 1000);
	}
	const verificationTime = Date.now();
	const verification = await supabase.auth.mfa.challengeAndVerify({
		factorId: authenticator.factorId,
		code: createCurrentAuthenticatorVerificationCode(
			authenticator.secret,
			verificationTime,
		),
	});
	if (verification.error) throw new Error("Local verification failed.");
	const claims = await supabase.auth.getClaims();
	if (
		claims.error ||
		claims.data?.claims.sub !== userId ||
		claims.data.claims.aal !== "aal2"
	) {
		throw new Error("Verified local session unavailable.");
	}
	authenticator.lastVerifiedStep = Math.floor(verificationTime / 30_000);
	await saveAuthenticator(path, authenticator);
};

export const completeAutomaticLocalQaMfa = async ({
	supabase,
	accountKey,
	runtime,
	cacheDirectory = resolve(".cache/local-qa-authenticators"),
}: {
	supabase: SupabaseClient<Database>;
	accountKey: string;
	runtime: LocalQaRuntimeInput;
	cacheDirectory?: string;
}) => {
	const account = getAutomaticLocalQaMfaAccount(accountKey, runtime);
	if (!account) return;
	try {
		const { data, error } = await supabase.auth.getUser();
		const user = data.user;
		if (error || !user || !UUID.test(user.id) || user.email !== account.email) {
			throw new Error("Local account mismatch.");
		}
		const key = `${cacheDirectory}:${user.id}`;
		const previous = pendingAccounts.get(key) ?? Promise.resolve();
		const current = previous
			.catch(() => {})
			.then(() => verifyAccount(supabase, user.id, cacheDirectory));
		pendingAccounts.set(key, current);
		try {
			await current;
		} finally {
			if (pendingAccounts.get(key) === current) pendingAccounts.delete(key);
		}
	} catch {
		throw new Error(
			"Automatic local verification failed. Please retry Quick QA login.",
		);
	}
};
