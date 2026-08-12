import {
	getAppReferenceCatalog,
} from "$lib/server/reference/appReferenceCatalog.server";
import {
	getFoodSafetyPolicy,
	type FoodSafetyPolicy,
} from "$lib/server/food-safety/foodSafetyPolicy.server";
import { getUserFoodPreferenceResolutions } from "$lib/server/food-safety/userFoodPreferenceResolution.server";
import {
	PROFILE_AVATAR_POLICY_ITEMS,
	PROFILE_AVATAR_REQUIRE_HUMAN_FACE,
} from "$lib/utils/profile/avatarPolicy";
import {
	getSignedAvatarUrl,
	getUserProfile,
} from "$lib/utils/profile/profile";
import { getDefaultDisplayName } from "$lib/utils/profile/profileValidation";
import {
	getFoodPreferenceProfile,
	isMissingFoodPreferencesTableError,
} from "$lib/utils/profile/foodPreferenceProfile";
import {
	getFoodPreferenceOptionSets,
	isMissingFoodPreferenceOptionCatalogError,
} from "$lib/utils/profile/foodPreferenceOptions";
import type { RegulatoryRegionOption } from "$lib/utils/profile/regulatoryRegion";
import { getDefaultMixFields } from "$lib/utils/food/reference/appReferenceCatalog";
import type { ProfilePageDataReaderOptions } from "./types";
import {
	getIdentityVerificationRequiredModeratorActionSummary,
	getUnavailableModeratorActionSummary,
	readModeratorActionSummary,
} from "$lib/server/moderation/moderatorActionSummary.server";
import { readMfaSecurityStatus } from "$lib/server/auth/mfaAccess.server";

export const getRegulatoryRegionOptions = (
	policy: FoodSafetyPolicy,
): RegulatoryRegionOption[] => policy.regionalProfiles.map((profile) => ({
	regionCode: profile.regionCode,
	displayName: profile.displayName,
	authority: profile.authority,
}));

export const loadProfilePageData = async ({
	supabase,
	userId,
	appRole,
}: ProfilePageDataReaderOptions) => {
	const profileWithAvatarPromise = getUserProfile(supabase, userId)
		.then(async (profile) => ({
			profile,
			avatarUrl: await getSignedAvatarUrl(supabase, profile?.avatar_path),
		}));
	const moderatorActionSummaryPromise = appRole
		? readMfaSecurityStatus(supabase)
			.then((status) => status.currentLevel === "aal2"
				? readModeratorActionSummary().catch(() =>
					getUnavailableModeratorActionSummary())
				: getIdentityVerificationRequiredModeratorActionSummary())
			.catch(() => getUnavailableModeratorActionSummary())
		: Promise.resolve(null);

	const [
		{ profile, avatarUrl },
		{ data: foodPreferences, error: foodPreferencesError },
		{ data: foodPreferenceOptions, error: foodPreferenceOptionsError },
		appReferenceCatalog,
		foodSafetyPolicy,
		preferenceResolutions,
		moderatorActionSummary,
	] = await Promise.all([
		profileWithAvatarPromise,
		supabase
			.from("user_food_preferences")
			.select(
				"unit_system, allergens, dietary_restrictions, prioritized_nutrient_ids, default_smoothie_serving_grams, sensitive_acknowledged_at, regulatory_region_code, regulatory_region_source",
			)
			.eq("user_id", userId)
			.maybeSingle(),
		supabase
			.from("food_preference_option_catalog")
			.select(
				"category, label, normalized_value, source_values, tag_id, usage_count",
			)
			.order("usage_count", { ascending: false })
			.order("label", { ascending: true }),
		getAppReferenceCatalog(),
		getFoodSafetyPolicy(),
		getUserFoodPreferenceResolutions(supabase, userId),
		moderatorActionSummaryPromise,
	]);

	const foodPreferencesUnavailable =
		isMissingFoodPreferencesTableError(foodPreferencesError);
	if (foodPreferencesError && !foodPreferencesUnavailable) {
		throw foodPreferencesError;
	}

	const foodPreferenceOptionsUnavailable =
		isMissingFoodPreferenceOptionCatalogError(foodPreferenceOptionsError);
	if (foodPreferenceOptionsError && !foodPreferenceOptionsUnavailable) {
		throw foodPreferenceOptionsError;
	}

	return {
		profile,
		avatarUrl,
		foodPreferences: foodPreferencesUnavailable
			? null
			: getFoodPreferenceProfile(foodPreferences, preferenceResolutions),
		foodPreferencesUnavailable,
		foodPreferenceOptions: getFoodPreferenceOptionSets(
			foodPreferenceOptionsUnavailable ? [] : foodPreferenceOptions,
		),
		foodPreferenceOptionsUnavailable,
		priorityNutrientOptions: getDefaultMixFields(appReferenceCatalog),
		regulatoryRegionOptions: getRegulatoryRegionOptions(foodSafetyPolicy),
		defaultDisplayName: getDefaultDisplayName(userId),
		avatarPolicyItems: PROFILE_AVATAR_POLICY_ITEMS,
		requireHumanFace: PROFILE_AVATAR_REQUIRE_HUMAN_FACE,
		moderatorActionSummary,
	};
};
