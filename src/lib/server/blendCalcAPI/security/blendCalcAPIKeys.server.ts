import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Database } from "$lib/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

const API_KEY_PATTERN = /^bc_(test|live)_([A-Za-z0-9_-]{43})$/;

export type BlendCalcAPIKeyEnvironment = "test" | "live";

export type IssuedBlendCalcAPIKey = {
	id: string;
	clientId: string;
	name: string;
	key: string;
	keyPrefix: string;
	scopes: string[];
	issuedAt: string;
	expiresAt: string | null;
};

const hashBlendCalcAPIKey = (key: string) =>
	createHash("sha256").update(key).digest("hex");

const normalizeKeyName = (name: string) => {
	const normalized = name.trim();
	if (!normalized || normalized.length > 120) {
		throw new Error("API key name must contain 1 through 120 characters.");
	}
	return normalized;
};

const normalizeScopes = (scopes: readonly string[]) => [
	...new Set(scopes.map((scope) => scope.trim()).filter(Boolean)),
];

const createSecretMaterial = (environment: BlendCalcAPIKeyEnvironment) => {
	const secret = randomBytes(32).toString("base64url");
	const key = `bc_${environment}_${secret}`;
	return {
		key,
		keyPrefix: `bc_${environment}_${secret.slice(0, 10)}`,
		keyHash: hashBlendCalcAPIKey(key),
	};
};

export const issueBlendCalcAPIKey = async (input: {
	supabase: SupabaseClient<Database>;
	clientId: string;
	name: string;
	scopes: readonly string[];
	environment: BlendCalcAPIKeyEnvironment;
	expiresAt?: string | null;
	createdBy?: string | null;
}): Promise<IssuedBlendCalcAPIKey> => {
	const id = randomUUID();
	const issuedAt = new Date().toISOString();
	const expiresAt = input.expiresAt ?? null;
	if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
		throw new Error("API key expiry must be in the future.");
	}
	const name = normalizeKeyName(input.name);
	const scopes = normalizeScopes(input.scopes);
	const secret = createSecretMaterial(input.environment);
	const { error } = await input.supabase.from("blendcalc_api_keys").insert({
		id,
		client_id: input.clientId,
		name,
		key_prefix: secret.keyPrefix,
		key_hash: secret.keyHash,
		scopes,
		issued_at: issuedAt,
		expires_at: expiresAt,
		created_by: input.createdBy ?? null,
	});
	if (error) throw error;
	return {
		id,
		clientId: input.clientId,
		name,
		key: secret.key,
		keyPrefix: secret.keyPrefix,
		scopes,
		issuedAt,
		expiresAt,
	};
};

export const authenticateBlendCalcAPIKey = async (
	supabase: SupabaseClient<Database>,
	key: string,
	completeBackgroundTask: (task: Promise<unknown>) => Promise<void> = async (
		task,
	) => {
		await task;
	},
) => {
	if (!API_KEY_PATTERN.test(key)) return null;
	const { data, error } = await supabase
		.from("blendcalc_api_keys")
		.select(
			"id, client_id, name, key_prefix, scopes, issued_at, last_used_at, expires_at",
		)
		.eq("key_hash", hashBlendCalcAPIKey(key))
		.is("revoked_at", null)
		.maybeSingle();
	if (error) throw error;
	if (!data || (data.expires_at && Date.parse(data.expires_at) <= Date.now()))
		return null;
	await completeBackgroundTask(
		Promise.resolve(
			supabase
				.from("blendcalc_api_keys")
				.update({ last_used_at: new Date().toISOString() })
				.eq("id", data.id),
		).then(({ error: updateError }) => {
			if (updateError) throw updateError;
		}),
	);
	return data;
};

export const revokeBlendCalcAPIKey = async (input: {
	supabase: SupabaseClient<Database>;
	keyId: string;
	reason: string;
}) => {
	const reason = input.reason.trim();
	if (!reason) throw new Error("API key revocation requires a reason.");
	const { error } = await input.supabase
		.from("blendcalc_api_keys")
		.update({ revoked_at: new Date().toISOString(), revocation_reason: reason })
		.eq("id", input.keyId)
		.is("revoked_at", null);
	if (error) throw error;
};

export const rotateBlendCalcAPIKey = async (input: {
	supabase: SupabaseClient<Database>;
	currentKeyId: string;
	clientId: string;
	name: string;
	scopes: readonly string[];
	environment: BlendCalcAPIKeyEnvironment;
	expiresAt?: string | null;
	createdBy?: string | null;
}): Promise<IssuedBlendCalcAPIKey> => {
	const id = randomUUID();
	const name = normalizeKeyName(input.name);
	const scopes = normalizeScopes(input.scopes);
	const expiresAt = input.expiresAt ?? null;
	const secret = createSecretMaterial(input.environment);
	const { error } = await input.supabase.rpc("rotate_blendcalc_api_key", {
		p_current_key_id: input.currentKeyId,
		p_new_key_id: id,
		p_name: name,
		p_key_prefix: secret.keyPrefix,
		p_key_hash: secret.keyHash,
		p_scopes: scopes,
		p_expires_at: input.expiresAt ?? undefined,
		p_created_by: input.createdBy ?? undefined,
	});
	if (error) throw error;
	return {
		id,
		clientId: input.clientId,
		name,
		key: secret.key,
		keyPrefix: secret.keyPrefix,
		scopes,
		issuedAt: new Date().toISOString(),
		expiresAt,
	};
};
