import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";
import { getPasswordUpgradeNext } from "$lib/utils/auth/passwordUpgrade";

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

	return {
		authUser: user
			? {
					id: user.id,
					email: user.email ?? null,
				}
			: null,
	};
};
