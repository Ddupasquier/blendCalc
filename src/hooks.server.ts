import { createSupabaseServerClient } from "$lib/supabase/server";
import { readVerifiedAuthUser } from "$lib/server/auth/verifiedAuthUser.server";
import { applySecurityHeaders } from "$lib/utils/http/securityHeaders";
import { isActiveAccountBlock } from "$lib/utils/moderation/moderation";
import { APP_BUILD_VERSION, APP_VERSION } from "$lib/config/version";
import { createAppIssuePayload } from "$lib/utils/errors/appIssues";
import {
	DARK_THEME_COLOR,
	normalizeThemePreference,
	THEME_PREFERENCE_COOKIE,
} from "$lib/utils/theme/themePreference";
import { env } from "$env/dynamic/private";
import {
	redirect,
	type Handle,
	type HandleServerError,
} from "@sveltejs/kit";

export const handleError: HandleServerError = ({ error, event, status }) => {
	const technicalError = error instanceof Error
		? { name: error.name, message: error.message }
		: { type: typeof error };
	console.error("[request] Unexpected server error", {
		method: event.request.method,
		path: event.url.pathname,
		status,
		error: technicalError,
	});
	return createAppIssuePayload("UNEXPECTED_ERROR");
};

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createSupabaseServerClient(event.cookies);

	let authResult: ReturnType<App.Locals["getVerifiedUser"]> | null = null;
	event.locals.getVerifiedUser = () => {
		authResult ??= readVerifiedAuthUser(event.locals.supabase, {
			requireCurrentAuthRecord:
				env.BLENDCALC_DATABASE_ENVIRONMENT === "test",
		});
		return authResult;
	};

	const user = await event.locals.getVerifiedUser();
	event.locals.user = user;

	if (user) {
		const { data: moderation, error: moderationError } = await event.locals.supabase
			.from("account_moderation")
			.select("status, expires_at")
			.eq("user_id", user.id)
			.maybeSingle();

		if (moderationError) {
			console.error("[moderation] Unable to verify account status", {
				userId: user.id,
				code: moderationError.code,
			});
		} else if (
			moderation &&
			isActiveAccountBlock(moderation.status, moderation.expires_at)
		) {
			await event.locals.supabase.auth.signOut({ scope: "local" });
			throw redirect(303, "/auth?error=account_blocked");
		}
	}

	const response = await resolve(event, {
		filterSerializedResponseHeaders: (name) => {
			return name === "content-encoding" || name === "content-range";
		},
		transformPageChunk: ({ html }) => {
			const preference = normalizeThemePreference(
				event.cookies.get(THEME_PREFERENCE_COOKIE),
			);
			const themedHtml = html.replace(
				'<html lang="en" data-theme="system">',
				`<html lang="en" data-theme="${preference}">`,
			);
			return preference === "dark"
				? themedHtml.replace(
						'<meta name="theme-color" content="#f8f8fb"/>',
						`<meta name="theme-color" content="${DARK_THEME_COLOR}"/>`,
					)
				: themedHtml;
		},
	});

	applySecurityHeaders(response, event.url, Boolean(user));
	response.headers.set("x-blendcalc-app-version", APP_VERSION);
	response.headers.set("x-blendcalc-app-build", APP_BUILD_VERSION);
	return response;
};
