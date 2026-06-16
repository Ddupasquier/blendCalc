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

const PUBLIC_PATHS = new Set(["/", "/auth"]);

const isPublicPath = (pathname: string) => {
	return PUBLIC_PATHS.has(pathname) || pathname.startsWith("/auth/callback");
};

export const load: LayoutServerLoad = async ({ locals, url, cookies }) => {
	const { user } = await locals.safeGetSession();

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

	const [profile, role, tutorialPreference] = await Promise.all([
		getUserProfile(locals.supabase, user.id),
		getUserAppRole(locals.supabase, user.id),
		getTutorialPreference(locals.supabase, user.id),
	]);
	const avatarUrl = await getSignedAvatarUrl(locals.supabase, profile?.avatar_path);

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
	};
};
