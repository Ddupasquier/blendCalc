import { createHash, randomUUID } from "node:crypto";
import { fail, redirect } from "@sveltejs/kit";
import { dev } from "$app/environment";
import type { Actions } from "./$types";
import {
	PROFILE_AVATAR_POLICY_ITEMS,
	PROFILE_AVATAR_POLICY_VERSION,
	PROFILE_AVATAR_REQUIRE_HUMAN_FACE,
} from "$lib/utils/profile/avatarPolicy";
import {
	getUserProfile,
	isMissingCheekyMessagesPreferenceColumn,
	PROFILE_AVATAR_BUCKET,
} from "$lib/utils/profile/profile";
import {
	getDefaultDisplayName,
	getProfileValidationError,
	isProfileAvatarType,
	matchesAvatarFileSignature,
	normalizeOptionalProfileText,
	PROFILE_AVATAR_ALT_TEXT_MAX_LENGTH,
	PROFILE_AVATAR_MAX_BYTES,
} from "$lib/utils/profile/profileValidation";
import {
	getFoodPreferencesValidationError,
	getServingSizeGrams,
	normalizeServingUnit,
	normalizeUnitSystem,
	parseRepeatedFoodPreferenceValues,
	parsePrioritizedNutrientIds,
	type FoodPreferenceFormValues,
} from "$lib/utils/profile/foodPreferences";
import {
	normalizeRegulatoryRegionCode,
	normalizeRegulatoryRegionSource,
} from "$lib/utils/profile/regulatoryRegion";
import {
	isMissingFoodPreferencesTableError,
} from "$lib/utils/profile/foodPreferenceProfile";
import {
	getThemePreferenceCookieOptions,
	isThemePreference,
	THEME_PREFERENCE_COOKIE,
} from "$lib/utils/theme/themePreference";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";
import { normalizeImageUpload } from "$lib/server/uploads/normalizeImageUpload.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { consumeRequestRateLimit } from "$lib/server/security/requestRateLimit.server";
import { getAppIssueMessage } from "$lib/utils/errors/appIssues";
import {
	getFoodSafetyPolicy,
} from "$lib/server/food-safety/foodSafetyPolicy.server";
import {
	getRegulatoryRegionOptions,
} from "$lib/server/profile/profilePageData.server";
import { getAppReferenceCatalog } from "$lib/server/reference/appReferenceCatalog.server";
import { getDefaultMixFields } from "$lib/utils/food/reference/appReferenceCatalog";

const PROFILE_TEXT_FORM_MAX_BYTES = 64 * 1024;
const PROFILE_AVATAR_FORM_MAX_BYTES = PROFILE_AVATAR_MAX_BYTES + 1024 * 1024;
const PROFILE_AVATAR_MAX_DIMENSION = 2048;

const getAuthenticatedUser = async (locals: App.Locals) => {
	const user = await locals.getVerifiedUser();
	if (!user) throw redirect(303, "/auth?next=%2Fprofile");
	return user;
};

const getProfileFormValues = (formData: FormData) => {
	return {
		displayName: normalizeOptionalProfileText(formData.get("displayName")),
		bio: normalizeOptionalProfileText(formData.get("bio")),
	};
};

const getFoodPreferenceFormValues = (
	formData: FormData,
): FoodPreferenceFormValues => {
	return {
		unitSystem: normalizeUnitSystem(formData.get("unitSystem")),
		allergens: parseRepeatedFoodPreferenceValues(formData.getAll("allergens")),
		dietaryRestrictions: parseRepeatedFoodPreferenceValues(
			formData.getAll("dietaryRestrictions"),
		),
		prioritizedNutrientIds: parsePrioritizedNutrientIds(
			formData.getAll("prioritizedNutrientIds"),
		),
		defaultMixServingSize: String(
			formData.get("defaultMixServingSize") ?? "",
		).trim(),
		defaultMixServingUnit: normalizeServingUnit(
			formData.get("defaultMixServingUnit"),
		),
		sensitiveAcknowledged: formData.get("sensitiveAcknowledged") === "on",
		regulatoryRegionCode: normalizeRegulatoryRegionCode(
			formData.get("regulatoryRegionCode"),
		),
		regulatoryRegionSource: normalizeRegulatoryRegionSource(
			formData.get("regulatoryRegionSource"),
		),
	};
};

export const actions: Actions = {
	savePlayfulMessages: async ({ locals, request }) => {
		const user = await getAuthenticatedUser(locals);
		const formData = await readLimitedFormData(request, PROFILE_TEXT_FORM_MAX_BYTES);
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
	},
	saveAppearance: async ({ locals, request, cookies }) => {
		const user = await getAuthenticatedUser(locals);
		const formData = await readLimitedFormData(request, PROFILE_TEXT_FORM_MAX_BYTES);
		const appearanceTheme = formData.get("appearanceTheme");

		if (!isThemePreference(appearanceTheme)) {
			return fail(400, {
				appearanceError: "Choose a color theme and try again.",
			});
		}

		const existingProfile = await getUserProfile(locals.supabase, user.id);
		const { error } = await getSupabaseAdminClient().from("profiles").upsert(
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
	},
	saveProfile: async ({ locals, request }) => {
		const user = await getAuthenticatedUser(locals);
		const values = getProfileFormValues(
			await readLimitedFormData(request, PROFILE_TEXT_FORM_MAX_BYTES),
		);
		const displayName = values.displayName ?? getDefaultDisplayName(user.id);
		const validationError = getProfileValidationError(values);

		if (validationError) {
			return fail(400, { profileError: validationError, profileValues: values });
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
	},
	saveFoodPreferences: async ({ locals, request }) => {
		const user = await getAuthenticatedUser(locals);
		const values = getFoodPreferenceFormValues(
			await readLimitedFormData(request, PROFILE_TEXT_FORM_MAX_BYTES),
		);
		let regulatoryRegionOptions: ReturnType<typeof getRegulatoryRegionOptions>;
		let allowedPriorityNutrientIds: number[];
		try {
			const [foodSafetyPolicy, appReferenceCatalog] = await Promise.all([
				getFoodSafetyPolicy(),
				getAppReferenceCatalog(),
			]);
			regulatoryRegionOptions = getRegulatoryRegionOptions(foodSafetyPolicy);
			allowedPriorityNutrientIds = getDefaultMixFields(appReferenceCatalog).map(
				(nutrient) => nutrient.id,
			);
		} catch {
			return fail(503, {
				foodPreferencesError:
					"The latest food-preference choices could not be checked. Try again in a moment.",
				foodPreferenceValues: values,
			});
		}
		const validationError = getFoodPreferencesValidationError(
			values,
			{ regulatoryRegionOptions, allowedPriorityNutrientIds },
		);

		if (validationError) {
			return fail(400, {
				foodPreferencesError: validationError,
				foodPreferenceValues: values,
			});
		}

		const defaultMixServingGrams = getServingSizeGrams(
			values.defaultMixServingSize,
			values.defaultMixServingUnit,
		);
		const sensitiveAcknowledgedAt = values.sensitiveAcknowledged
			? new Date().toISOString()
			: null;

		const { error } = await locals.supabase.from("user_food_preferences").upsert(
			{
				user_id: user.id,
				unit_system: values.unitSystem,
				allergens: values.allergens,
				dietary_restrictions: values.dietaryRestrictions,
				prioritized_nutrient_ids: values.prioritizedNutrientIds,
				default_smoothie_serving_grams: defaultMixServingGrams,
				sensitive_acknowledged_at: sensitiveAcknowledgedAt,
				regulatory_region_code: values.regulatoryRegionCode || null,
				regulatory_region_source: values.regulatoryRegionSource,
			},
			{ onConflict: "user_id" },
		);

		if (error) {
			if (isMissingFoodPreferencesTableError(error)) {
				return fail(503, {
					foodPreferencesError:
						"Food preferences are temporarily unavailable. Try again soon.",
					foodPreferenceValues: values,
				});
			}

			return fail(500, {
				foodPreferencesError: "Food settings could not be saved. Try again.",
				foodPreferenceValues: values,
			});
		}

		return {
			foodPreferencesSuccess: "Food settings saved.",
			foodPreferenceValues: values,
		};
	},
	uploadAvatar: async ({ locals, request }) => {
		const user = await getAuthenticatedUser(locals);
		try {
			const rateLimit = await consumeRequestRateLimit({
				policy: {
					scope: "profile:avatar-upload",
					limit: 20,
					windowSeconds: 3600,
				},
				subject: `user:${user.id}`,
			});
			if (!rateLimit.allowed) {
				return fail(429, {
					avatarError: getAppIssueMessage("RATE_LIMITED"),
				});
			}
		} catch {
			return fail(503, {
				avatarError: getAppIssueMessage("SERVICE_UNAVAILABLE"),
			});
		}
		const formData = await readLimitedFormData(request, PROFILE_AVATAR_FORM_MAX_BYTES);
		const avatar = formData.get("avatar");
		const altText = normalizeOptionalProfileText(formData.get("avatarAltText"));
		const policyAccepted = formData.get("avatarPolicyAccepted") === "on";
		const faceConfirmed = formData.get("avatarHasHumanFace") === "on";

		if (!(avatar instanceof File) || avatar.size === 0) {
			return fail(400, { avatarError: "Choose an image to upload." });
		}
		if (!isProfileAvatarType(avatar.type)) {
			return fail(400, { avatarError: "Use a JPEG, PNG, or WebP image." });
		}
		if (avatar.size > PROFILE_AVATAR_MAX_BYTES) {
			return fail(400, { avatarError: "Profile images must be 5 MB or smaller." });
		}
		if (altText && altText.length > PROFILE_AVATAR_ALT_TEXT_MAX_LENGTH) {
			return fail(400, {
				avatarError: `Image description must be ${PROFILE_AVATAR_ALT_TEXT_MAX_LENGTH} characters or fewer.`,
			});
		}
		if (!policyAccepted) {
			return fail(400, {
				avatarError: "Confirm that the image follows the profile image rules.",
			});
		}
		if (PROFILE_AVATAR_REQUIRE_HUMAN_FACE && !faceConfirmed) {
			return fail(400, {
				avatarError: "Confirm that the image contains a recognizable human face.",
			});
		}

		const bytes = new Uint8Array(await avatar.arrayBuffer());
		if (!matchesAvatarFileSignature(bytes, avatar.type)) {
			return fail(400, {
				avatarError: "The selected file does not match its reported image type.",
			});
		}
		let normalizedAvatar;
		try {
			normalizedAvatar = await normalizeImageUpload({
				bytes,
				maximumOutputBytes: PROFILE_AVATAR_MAX_BYTES,
				maximumWidth: PROFILE_AVATAR_MAX_DIMENSION,
				maximumHeight: PROFILE_AVATAR_MAX_DIMENSION,
			});
		} catch {
			return fail(400, {
				avatarError: "We couldn’t read that image. Choose another JPEG, PNG, or WebP file.",
			});
		}

		const existingProfile = await getUserProfile(locals.supabase, user.id);
		const admin = getSupabaseAdminClient();
		const avatarPath =
			`${user.id}/avatar-${randomUUID()}.${normalizedAvatar.extension}`;
		const fileSha256 = createHash("sha256")
			.update(normalizedAvatar.bytes)
			.digest("hex");

		if (existingProfile?.avatar_path) {
			const { data: existingAcceptance, error: acceptanceLookupError } =
				await locals.supabase
					.from("profile_image_policy_acceptances")
					.select("id")
					.eq("user_id", user.id)
					.eq("avatar_path", existingProfile.avatar_path)
					.eq("file_sha256", fileSha256)
					.maybeSingle();

			if (acceptanceLookupError) {
				return fail(500, {
					avatarError: "The current profile image could not be checked. Try again.",
				});
			}
			if (existingAcceptance) {
				return fail(409, {
					avatarError: "That image is already your profile image.",
				});
			}
		}

		const { error: uploadError } = await admin.storage
			.from(PROFILE_AVATAR_BUCKET)
			.upload(avatarPath, normalizedAvatar.bytes, {
				contentType: normalizedAvatar.contentType,
				cacheControl: "3600",
				upsert: false,
			});

		if (uploadError) {
			return fail(500, { avatarError: "The image could not be uploaded. Try again." });
		}

		const { error: acceptanceError } = await admin
			.from("profile_image_policy_acceptances")
			.insert({
				user_id: user.id,
				avatar_path: avatarPath,
				file_sha256: fileSha256,
				policy_version: PROFILE_AVATAR_POLICY_VERSION,
				policy_items: [...PROFILE_AVATAR_POLICY_ITEMS],
			});

		if (acceptanceError) {
			await admin.storage.from(PROFILE_AVATAR_BUCKET).remove([avatarPath]);
			return fail(500, {
				avatarError: "Your policy confirmation could not be recorded. Try again.",
			});
		}

		const { error: profileError } = await admin.from("profiles").upsert(
			{
				user_id: user.id,
				display_name: existingProfile?.display_name ?? getDefaultDisplayName(user.id),
				avatar_path: avatarPath,
				avatar_alt_text: altText,
				avatar_moderation_status: "self_attested",
				avatar_policy_acknowledged_at: new Date().toISOString(),
			},
			{ onConflict: "user_id" },
		);

		if (profileError) {
			await admin.storage.from(PROFILE_AVATAR_BUCKET).remove([avatarPath]);
			return fail(500, { avatarError: "The profile image could not be saved. Try again." });
		}

		if (existingProfile?.avatar_path) {
			await admin.storage
				.from(PROFILE_AVATAR_BUCKET)
				.remove([existingProfile.avatar_path]);
		}

		return { avatarSuccess: "Profile image updated." };
	},
	removeAvatar: async ({ locals }) => {
		const user = await getAuthenticatedUser(locals);
		const profile = await getUserProfile(locals.supabase, user.id);
		if (!profile?.avatar_path) return { avatarSuccess: "No profile image to remove." };

		const admin = getSupabaseAdminClient();
		const { error } = await admin
			.from("profiles")
			.update({
				avatar_path: null,
				avatar_alt_text: null,
				avatar_moderation_status: "none",
				avatar_policy_acknowledged_at: null,
			})
			.eq("user_id", user.id);

		if (error) {
			return fail(500, { avatarError: "The profile image could not be removed." });
		}

		await admin.storage
			.from(PROFILE_AVATAR_BUCKET)
			.remove([profile.avatar_path]);

		return { avatarSuccess: "Profile image removed." };
	},
};
