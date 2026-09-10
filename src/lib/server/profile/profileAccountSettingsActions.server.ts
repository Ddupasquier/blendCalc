import { dev } from "$app/environment";
import { fail, type RequestEvent } from "@sveltejs/kit";
import {
	saveCurrentUserAppearanceTheme,
	saveCurrentUserPlayfulMessagePreference,
	saveCurrentUserProfileDetails,
} from "$lib/server/profile/profileOwnerSettings.server";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";
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
import { saveCurrentUserMarketingEmailPreferences } from "$lib/server/email/marketingEmailPreferences.server";
import {
	MARKETING_EMAIL_CONSENT_COPY_VERSION,
	MARKETING_EMAIL_TOPIC_KEYS,
	type MarketingEmailPreferenceValues,
} from "$lib/utils/email/marketingEmailPreferences";

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

const getMarketingEmailPreferenceValues = (formData: FormData) => {
	const values = {} as MarketingEmailPreferenceValues;
	for (const topicKey of MARKETING_EMAIL_TOPIC_KEYS) {
		const value = formData.get(topicKey);
		if (value !== "true" && value !== "false") return null;
		values[topicKey] = value === "true";
	}
	return values;
};

export const saveMarketingEmailPreferences = async ({
	locals,
	request,
}: ProfileAccountSettingsActionEvent) => {
	await requireAuthenticatedProfileUser(locals);
	const formData = await readLimitedFormData(
		request,
		PROFILE_ACCOUNT_SETTINGS_FORM_MAX_BYTES,
	);
	const emailPreferenceValues = getMarketingEmailPreferenceValues(formData);

	if (!emailPreferenceValues) {
		return fail(400, {
			emailPreferencesError:
				"Choose an on or off value for every optional email category.",
		});
	}

	const { error } = await saveCurrentUserMarketingEmailPreferences(
		locals.supabase,
		emailPreferenceValues,
		MARKETING_EMAIL_CONSENT_COPY_VERSION,
	);

	if (error) {
		return fail(500, {
			emailPreferencesError:
				"Your email preferences could not be saved. Try again.",
			emailPreferenceValues,
		});
	}

	return {
		emailPreferencesSuccess: "Email preferences saved.",
		emailPreferenceValues,
	};
};

export const savePlayfulMessagesPreference = async ({
	locals,
	request,
}: ProfileAccountSettingsActionEvent) => {
	await requireAuthenticatedProfileUser(locals);
	const formData = await readLimitedFormData(
		request,
		PROFILE_ACCOUNT_SETTINGS_FORM_MAX_BYTES,
	);
	const playfulMessagesEnabled =
		formData.get("playfulMessagesEnabled") === "true";
	const { data: savedPreference, error } =
		await saveCurrentUserPlayfulMessagePreference(
			locals.supabase,
			playfulMessagesEnabled,
		);

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
		playfulMessagesEnabled: savedPreference,
	};
};

export const saveProfileAppearance = async ({
	locals,
	request,
	cookies,
}: ProfileAppearanceActionEvent) => {
	await requireAuthenticatedProfileUser(locals);
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

	const { error } = await saveCurrentUserAppearanceTheme(
		locals.supabase,
		appearanceTheme,
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

	const { error } = await saveCurrentUserProfileDetails(locals.supabase, {
		displayName,
		bio: values.bio,
	});

	if (error) {
		return fail(500, {
			profileError: "Profile changes could not be saved. Try again.",
			profileValues: { ...values, displayName },
		});
	}

	return { profileSuccess: "Profile saved." };
};
