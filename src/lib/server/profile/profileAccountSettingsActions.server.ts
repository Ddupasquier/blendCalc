import { dev } from "$app/environment";
import { fail, type RequestEvent } from "@sveltejs/kit";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import {
	getUserProfile,
	isMissingCheekyMessagesPreferenceColumn,
} from "$lib/utils/profile/profile";
import {
	getDefaultDisplayName,
	getProfileValidationError,
	normalizeOptionalProfileText,
} from "$lib/utils/profile/profileValidation";
import {
	getThemePreferenceCookieOptions,
	isThemePreference,
	THEME_PREFERENCE_COOKIE,
} from "$lib/utils/theme/themePreference";
import { requireAuthenticatedProfileUser } from "./profileActionAuthentication.server";

const PROFILE_ACCOUNT_SETTINGS_FORM_MAX_BYTES = 64 * 1024;

type ProfileAccountSettingsActionEvent = Pick<
	RequestEvent,
	"locals" | "request"
>;
type ProfileAppearanceActionEvent = Pick<
	RequestEvent,
	"locals" | "request" | "cookies"
>;

const getProfileFormValues = (formData: FormData) => ({
	displayName: normalizeOptionalProfileText(formData.get("displayName")),
	bio: normalizeOptionalProfileText(formData.get("bio")),
});

export const savePlayfulMessagesPreference = async ({
	locals,
	request,
}: ProfileAccountSettingsActionEvent) => {
	const user = await requireAuthenticatedProfileUser(locals);
	const formData = await readLimitedFormData(
		request,
		PROFILE_ACCOUNT_SETTINGS_FORM_MAX_BYTES,
	);
	const playfulMessagesEnabled =
		formData.get("playfulMessagesEnabled") === "true";
	const existingProfile = await getUserProfile(locals.supabase, user.id);
	const { data: savedPreference, error } = await getSupabaseAdminClient()
		.from("profiles")
		.upsert(
			{
				user_id: user.id,
				display_name:
					existingProfile?.display_name ?? getDefaultDisplayName(user.id),
				cheeky_messages_enabled: playfulMessagesEnabled,
			},
			{ onConflict: "user_id" },
		)
		.select("cheeky_messages_enabled")
		.single();

	if (error) {
		return fail(isMissingCheekyMessagesPreferenceColumn(error) ? 503 : 500, {
			playfulMessagesError: isMissingCheekyMessagesPreferenceColumn(error)
				? "This preference is still being prepared. Try again shortly."
				: "Your message preference could not be saved. Try again.",
			playfulMessagesEnabled,
		});
	}

	return {
		playfulMessagesSuccess: "Playful messages saved.",
		playfulMessagesEnabled: savedPreference.cheeky_messages_enabled,
	};
};

export const saveProfileAppearance = async ({
	locals,
	request,
	cookies,
}: ProfileAppearanceActionEvent) => {
	const user = await requireAuthenticatedProfileUser(locals);
	const formData = await readLimitedFormData(
		request,
		PROFILE_ACCOUNT_SETTINGS_FORM_MAX_BYTES,
	);
	const appearanceTheme = formData.get("appearanceTheme");

	if (!isThemePreference(appearanceTheme)) {
		return fail(400, {
			appearanceError: "Choose a color theme and try again.",
		});
	}

	const existingProfile = await getUserProfile(locals.supabase, user.id);
	const { error } = await getSupabaseAdminClient()
		.from("profiles")
		.upsert(
			{
				user_id: user.id,
				display_name:
					existingProfile?.display_name ?? getDefaultDisplayName(user.id),
				appearance_theme: appearanceTheme,
			},
			{ onConflict: "user_id" },
		);

	if (error) {
		return fail(500, {
			appearanceError: "Your color theme could not be saved. Try again.",
		});
	}

	cookies.set(
		THEME_PREFERENCE_COOKIE,
		appearanceTheme,
		getThemePreferenceCookieOptions(!dev),
	);

	return {
		appearanceSuccess: "Color theme saved.",
		appearanceTheme,
	};
};

export const saveProfileDetails = async ({
	locals,
	request,
}: ProfileAccountSettingsActionEvent) => {
	const user = await requireAuthenticatedProfileUser(locals);
	const values = getProfileFormValues(
		await readLimitedFormData(request, PROFILE_ACCOUNT_SETTINGS_FORM_MAX_BYTES),
	);
	const displayName = values.displayName ?? getDefaultDisplayName(user.id);
	const validationError = getProfileValidationError(values);

	if (validationError) {
		return fail(400, {
			profileError: validationError,
			profileValues: values,
		});
	}

	const existingProfile = await getUserProfile(locals.supabase, user.id);
	if (
		existingProfile?.display_name === displayName &&
		(existingProfile.bio ?? null) === values.bio
	) {
		return {
			profileSuccess: "Your profile already has these details.",
			profileValues: { ...values, displayName },
		};
	}

	const { error } = await getSupabaseAdminClient().from("profiles").upsert(
		{
			user_id: user.id,
			display_name: displayName,
			bio: values.bio,
		},
		{ onConflict: "user_id" },
	);

	if (error) {
		return fail(500, {
			profileError: "Profile changes could not be saved. Try again.",
			profileValues: { ...values, displayName },
		});
	}

	return { profileSuccess: "Profile saved." };
};
