import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";

type AuthenticatedSupabaseClient = SupabaseClient<Database>;

export const saveCurrentUserProfileDetails = async (
	supabase: AuthenticatedSupabaseClient,
	values: { displayName: string; bio: string | null },
) =>
	supabase.rpc("save_current_user_profile_details", {
		p_display_name: values.displayName,
		p_bio: values.bio ?? "",
	});

export const saveCurrentUserAppearanceTheme = async (
	supabase: AuthenticatedSupabaseClient,
	appearanceTheme: string,
) =>
	supabase.rpc("save_current_user_appearance_theme", {
		p_appearance_theme: appearanceTheme,
	});

export const saveCurrentUserPlayfulMessagePreference = async (
	supabase: AuthenticatedSupabaseClient,
	enabled: boolean,
) =>
	supabase.rpc("save_current_user_playful_message_preference", {
		p_enabled: enabled,
	});

export const saveCurrentUserProfileImage = async (
	supabase: AuthenticatedSupabaseClient,
	values: {
		avatarPath: string;
		avatarAltText: string | null;
		policyVersion: string;
	},
) =>
	supabase.rpc("save_current_user_profile_image", {
		p_avatar_path: values.avatarPath,
		p_avatar_alt_text: values.avatarAltText ?? "",
		p_policy_version: values.policyVersion,
	});

export const saveCurrentUserProfileImageDescription = async (
	supabase: AuthenticatedSupabaseClient,
	values: { expectedAvatarPath: string; avatarAltText: string | null },
) =>
	supabase.rpc("save_current_user_profile_image_description", {
		p_expected_avatar_path: values.expectedAvatarPath,
		p_avatar_alt_text: values.avatarAltText ?? "",
	});

export const clearCurrentUserProfileImage = async (
	supabase: AuthenticatedSupabaseClient,
	expectedAvatarPath: string,
) =>
	supabase.rpc("clear_current_user_profile_image", {
		p_expected_avatar_path: expectedAvatarPath,
	});
