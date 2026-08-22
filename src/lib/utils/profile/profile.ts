import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "$lib/types/database.types";

export const PROFILE_AVATAR_BUCKET = "profile-avatars";
export const PROFILE_AVATAR_URL_TTL_SECONDS = 60 * 60;
const PROFILE_AVATAR_CACHE_TTL_MILLISECONDS = 50 * 60 * 1_000;
const PROFILE_AVATAR_CACHE_MAX_ENTRIES = 250;

type SignedAvatarCacheEntry = {
	url: string;
	expiresAt: number;
};

const signedAvatarCache = new Map<string, SignedAvatarCacheEntry>();
const pendingSignedAvatarReads = new Map<string, Promise<string | null>>();

export type UserProfile = Tables<"profiles">;

type ProfileReadError = {
	code?: string;
	message?: string;
};

export const isMissingCheekyMessagesPreferenceColumn = (
	error: ProfileReadError | null | undefined,
) =>
	Boolean(
		error?.code &&
			["42703", "PGRST204"].includes(error.code) &&
			error.message?.toLowerCase().includes("cheeky_messages_enabled"),
	);

export const getUserProfile = async (
	supabase: SupabaseClient<Database>,
	userId: string,
) => {
	const currentResult = await supabase
		.from("profiles")
		.select(
			"user_id, display_name, bio, appearance_theme, cheeky_messages_enabled, avatar_path, avatar_alt_text, avatar_moderation_status, avatar_policy_acknowledged_at, created_at, updated_at",
		)
		.eq("user_id", userId)
		.maybeSingle();

	if (!currentResult.error) return currentResult.data;
	if (!isMissingCheekyMessagesPreferenceColumn(currentResult.error)) {
		throw currentResult.error;
	}

	const legacyResult = await supabase
		.from("profiles")
		.select(
			"user_id, display_name, bio, appearance_theme, avatar_path, avatar_alt_text, avatar_moderation_status, avatar_policy_acknowledged_at, created_at, updated_at",
		)
		.eq("user_id", userId)
		.maybeSingle();
	if (legacyResult.error) throw legacyResult.error;
	return legacyResult.data
		? { ...legacyResult.data, cheeky_messages_enabled: true }
		: null;
};

export const getSignedAvatarUrl = async (
	supabase: SupabaseClient<Database>,
	avatarPath: string | null | undefined,
) => {
	if (!avatarPath) return null;
	const now = Date.now();
	const cached = signedAvatarCache.get(avatarPath);
	if (cached && cached.expiresAt > now) {
		signedAvatarCache.delete(avatarPath);
		signedAvatarCache.set(avatarPath, cached);
		return cached.url;
	}
	if (cached) signedAvatarCache.delete(avatarPath);

	const pending = pendingSignedAvatarReads.get(avatarPath);
	if (pending) return pending;

	const request = (async () => {
		const { data, error } = await supabase.storage
			.from(PROFILE_AVATAR_BUCKET)
			.createSignedUrl(avatarPath, PROFILE_AVATAR_URL_TTL_SECONDS);

		if (error) return null;
		signedAvatarCache.set(avatarPath, {
			url: data.signedUrl,
			expiresAt: Date.now() + PROFILE_AVATAR_CACHE_TTL_MILLISECONDS,
		});
		while (signedAvatarCache.size > PROFILE_AVATAR_CACHE_MAX_ENTRIES) {
			const oldestPath = signedAvatarCache.keys().next().value;
			if (!oldestPath) break;
			signedAvatarCache.delete(oldestPath);
		}
		return data.signedUrl;
	})();
	pendingSignedAvatarReads.set(avatarPath, request);

	try {
		return await request;
	} finally {
		if (pendingSignedAvatarReads.get(avatarPath) === request) {
			pendingSignedAvatarReads.delete(avatarPath);
		}
	}
};
