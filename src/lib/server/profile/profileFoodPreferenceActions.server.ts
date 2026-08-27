import { fail, type RequestEvent } from "@sveltejs/kit";
import { getFoodSafetyPolicy } from "$lib/server/food-safety/foodSafetyPolicy.server";
import { getRegulatoryRegionOptions } from "$lib/server/profile/profilePageData.server";
import { getAppReferenceCatalog } from "$lib/server/reference/appReferenceCatalog.server";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";
import { getDefaultMixFields } from "$lib/utils/food/reference/appReferenceCatalog";
import { isMissingFoodPreferencesTableError } from "$lib/utils/profile/foodPreferenceProfile";
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
import { requireAuthenticatedProfileUser } from "./profileActionAuthentication.server";

const PROFILE_FOOD_PREFERENCES_FORM_MAX_BYTES = 64 * 1024;

type ProfileFoodPreferenceActionEvent = Pick<
	RequestEvent,
	"locals" | "request"
>;

const getFoodPreferenceFormValues = (
	formData: FormData,
): FoodPreferenceFormValues => ({
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
});

export const saveProfileFoodPreferences = async ({
	locals,
	request,
}: ProfileFoodPreferenceActionEvent) => {
	const user = await requireAuthenticatedProfileUser(locals);
	const values = getFoodPreferenceFormValues(
		await readLimitedFormData(request, PROFILE_FOOD_PREFERENCES_FORM_MAX_BYTES),
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
	const validationError = getFoodPreferencesValidationError(values, {
		regulatoryRegionOptions,
		allowedPriorityNutrientIds,
	});

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
};
