/**
 * Purpose: Inventory the exact Storage objects represented by a Rehearsal export and
 * stream them through a dedicated read-only Storage Auth identity. Do not run directly.
 */

import { createClient } from "@supabase/supabase-js";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAXIMUM_ASSET_BYTES = 50 * 1024 * 1024;

const collectPathStrings = (value, output = []) => {
	if (
		typeof value === "string" &&
		!value.includes("://") &&
		value.includes("/")
	) {
		output.push(value);
	} else if (Array.isArray(value)) {
		for (const entry of value) collectPathStrings(entry, output);
	} else if (value && typeof value === "object") {
		for (const entry of Object.values(value)) collectPathStrings(entry, output);
	}
	return output;
};

export const createStorageAssetInventory = ({
	ownerSourceUserId,
	ownerPersonaUserId,
}) => {
	if (
		!UUID_PATTERN.test(ownerSourceUserId) ||
		!UUID_PATTERN.test(ownerPersonaUserId)
	) {
		throw new Error(
			"Rehearsal Storage inventory requires both owner identities.",
		);
	}
	const assets = new Map();
	const add = (bucket, sourcePath, ownerScoped = false) => {
		if (typeof sourcePath !== "string" || !sourcePath.trim()) return;
		if (ownerScoped && !sourcePath.startsWith(`${ownerSourceUserId}/`)) {
			throw new Error(
				`An owner Storage path escaped the approved source prefix in ${bucket}.`,
			);
		}
		assets.set(`${bucket}\0${sourcePath}`, {
			bucket,
			sourcePath,
			objectPath: ownerScoped
				? sourcePath.replace(ownerSourceUserId, ownerPersonaUserId)
				: sourcePath,
		});
	};
	return Object.freeze({
		observe(record, { ownerRow = false } = {}) {
			if (record.table === "food_image_assets") {
				add("food-image-assets", record.row.storage_path);
			}
			if (!ownerRow) return;
			if (record.table === "profiles") {
				add("profile-avatars", record.row.avatar_path, true);
			}
			if (record.table === "food_compatibility_feedback") {
				add("product-submission-evidence", record.row.evidence_path, true);
			}
			if (record.table === "shared_product_submissions") {
				for (const path of collectPathStrings(record.row.evidence_paths)) {
					add("product-submission-evidence", path, true);
				}
			}
		},
		values() {
			return [...assets.values()];
		},
	});
};

const decodeJwtPayload = (token) => {
	const encoded = token.split(".")[1];
	if (!encoded)
		throw new Error("The Rehearsal Storage identity returned no JWT.");
	return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
};

export const streamAuthorizedStorageAssets = async function* ({
	apiUrl,
	publishableKey,
	email,
	password,
	accessToken,
	refreshToken,
	ownerSourceUserId,
	descriptors,
}) {
	const url = new URL(apiUrl);
	if (
		url.protocol !== "https:" &&
		!["localhost", "127.0.0.1", "::1"].includes(url.hostname)
	) {
		throw new Error("A hosted Rehearsal Storage source must use HTTPS.");
	}
	const client = createClient(apiUrl, publishableKey, {
		auth: {
			autoRefreshToken: false,
			detectSessionInUrl: false,
			persistSession: false,
		},
	});
	const useSessionTokens = Boolean(accessToken || refreshToken);
	if (useSessionTokens && (!accessToken || !refreshToken)) {
		throw new Error(
			"The Rehearsal Storage session requires both access and refresh tokens.",
		);
	}
	if (!useSessionTokens && (!email || !password)) {
		throw new Error(
			"The Rehearsal Storage identity requires a complete authentication method.",
		);
	}
	const { data, error } = useSessionTokens
		? await client.auth.setSession({
				access_token: accessToken,
				refresh_token: refreshToken,
			})
		: await client.auth.signInWithPassword({ email, password });
	if (error || !data.session) {
		throw new Error(
			"The read-only Rehearsal Storage identity could not sign in.",
			{
				cause: error ?? undefined,
			},
		);
	}
	const claims = decodeJwtPayload(data.session.access_token);
	if (
		claims.role !== "rehearsal_storage_reader" ||
		claims.app_metadata?.rehearsal_owner_user_id !== ownerSourceUserId
	) {
		throw new Error(
			"The Rehearsal Storage identity has an invalid scope receipt.",
		);
	}
	for (const descriptor of descriptors) {
		const { data: object, error: downloadError } = await client.storage
			.from(descriptor.bucket)
			.download(descriptor.sourcePath);
		if (downloadError || !object) {
			throw new Error(
				`A required Rehearsal Storage object could not be read from ${descriptor.bucket}.`,
				{ cause: downloadError ?? undefined },
			);
		}
		if (object.size > MAXIMUM_ASSET_BYTES) {
			throw new Error("A Rehearsal Storage object exceeded the byte boundary.");
		}
		yield {
			bucket: descriptor.bucket,
			objectPath: descriptor.objectPath,
			contentType: object.type || "application/octet-stream",
			content: Buffer.from(await object.arrayBuffer()),
		};
	}
};
