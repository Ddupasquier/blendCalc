import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { getPasswordUpgradeNext } from "$lib/utils/auth/passwordUpgrade";
import { getSignedAvatarUrl, getUserProfile } from "$lib/utils/profile/profile";
import { getDefaultDisplayName } from "$lib/utils/profile/profileValidation";
import { getUserAppRole } from "$lib/utils/moderation/moderation";
import {
	getTutorialPreference,
	shouldAutomaticallyShowTutorial,
} from "$lib/utils/tutorial/tutorial";
import { configureServingMeasureCatalog } from "$lib/utils/serving/servingMeasureCatalog";
import { getServingMeasureCatalog } from "$lib/server/serving/servingMeasureCatalog.server";
import { getNutritionCompletenessCatalog } from "$lib/server/nutrition/nutritionCompletenessCatalog.server";
import { configureNutritionCompletenessCatalog } from "$lib/utils/food/quality/nutritionCompletenessCatalog";
import { getAppReferenceCatalog } from "$lib/server/reference/appReferenceCatalog.server";
import { configureAppReferenceCatalog } from "$lib/utils/food/reference/appReferenceCatalog";

const PUBLIC_PATHS = new Set(["/", "/auth"]);

const isPublicPath = (pathname: string) => {
	return PUBLIC_PATHS.has(pathname) || pathname.startsWith("/auth/callback");
};

export const load: LayoutServerLoad = async ({ locals, url, cookies }) => {
	const user = await locals.getVerifiedUser();

	if (!user && !isPublicPath(url.pathname)) {
		throw redirect(
			303,
			`/?next=${encodeURIComponent(`${url.pathname}${url.search}`)}`,
		);
	}

	const passwordUpgradeNext = user ? getPasswordUpgradeNext(cookies) : null;
	if (passwordUpgradeNext && url.pathname !== "/auth/update-password") {
		throw redirect(
			303,
			`/auth/update-password?reason=policy&next=${encodeURIComponent(passwordUpgradeNext)}`,
		);
	}

	if (!user) return { authUser: null };

	const profileWithAvatarPromise = getUserProfile(locals.supabase, user.id)
		.then(async (profile) => ({
			profile,
			avatarUrl: await getSignedAvatarUrl(
				locals.supabase,
				profile?.avatar_path,
			),
		}));
	const [
		{ profile, avatarUrl },
		role,
		tutorialPreference,
		servingMeasureCatalog,
		nutritionCompletenessCatalog,
		appReferenceCatalog,
	] = await Promise.all([
		profileWithAvatarPromise,
		getUserAppRole(locals.supabase, user.id),
		getTutorialPreference(locals.supabase, user.id),
		getServingMeasureCatalog(),
		getNutritionCompletenessCatalog(),
		getAppReferenceCatalog(),
	]);
	configureServingMeasureCatalog(servingMeasureCatalog);
	configureNutritionCompletenessCatalog(nutritionCompletenessCatalog);
	configureAppReferenceCatalog(appReferenceCatalog);
	return {
		authUser: {
			id: user.id,
			displayName: profile?.display_name ?? getDefaultDisplayName(user.id),
			welcomeName: profile?.display_name ?? getDefaultDisplayName(user.id),
			avatarUrl,
			avatarAltText: profile?.avatar_alt_text ?? null,
			role,
			showTutorial: shouldAutomaticallyShowTutorial(tutorialPreference),
		},
		servingMeasureCatalog,
		nutritionCompletenessCatalog,
		appReferenceCatalog,
	};
};
