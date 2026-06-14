import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "$lib/types/database.types";

export const PROFILE_AVATAR_BUCKET = "profile-avatars";
export const PROFILE_AVATAR_URL_TTL_SECONDS = 60 * 60;

export type UserProfile = Tables<"profiles">;

export const getUserProfile = async (
	supabase: SupabaseClient<Database>,
	userId: string,
) => {
	const { data, error } = await supabase
		.from("profiles")
		.select("*")
		.eq("user_id", userId)
		.maybeSingle();

	if (error) throw error;
	return data;
};

export const getSignedAvatarUrl = async (
	supabase: SupabaseClient<Database>,
	avatarPath: string | null | undefined,
) => {
	if (!avatarPath) return null;
	const { data, error } = await supabase.storage
		.from(PROFILE_AVATAR_BUCKET)
		.createSignedUrl(avatarPath, PROFILE_AVATAR_URL_TTL_SECONDS);

	if (error) return null;
	return data.signedUrl;
};
