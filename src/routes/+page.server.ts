import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const getSafeNextPath = (value: string | null) => {
	if (!value || !value.startsWith("/") || value.startsWith("//")) {
		return "/ingredients/fridge";
	}
	return value;
};

export const load: PageServerLoad = async ({ locals, url }) => {
	const code = url.searchParams.get("code");
	if (code) {
		console.warn("[auth] OAuth code returned to the site root; recovering callback", {
			origin: url.origin,
		});
		const callbackUrl = new URL("/auth/callback", url);
		for (const key of ["code", "error", "error_code", "error_description"]) {
			const value = url.searchParams.get(key);
			if (value) callbackUrl.searchParams.set(key, value);
		}
		throw redirect(303, `${callbackUrl.pathname}${callbackUrl.search}`);
	}

	const user = await locals.getVerifiedUser();

	if (user) {
		throw redirect(303, getSafeNextPath(url.searchParams.get("next")));
	}

	return {
		next: getSafeNextPath(url.searchParams.get("next")),
	};
};
