import { createSupabaseServerClient } from "$lib/supabase/server";
import { readVerifiedAuthUser } from "$lib/server/auth/verifiedAuthUser.server";
import { applySecurityHeaders } from "$lib/utils/http/securityHeaders";
import { isActiveAccountBlock } from "$lib/utils/moderation/moderation";
import { APP_BUILD_VERSION, APP_VERSION } from "$lib/config/version";
import { createAppIssuePayload } from "$lib/utils/errors/appIssues";
import {
	consumeRequestRateLimit,
	getRequestRateLimitPolicy,
} from "$lib/server/security/requestRateLimit.server";
import {
	DARK_THEME_COLOR,
	LIGHT_THEME_COLOR,
	normalizeThemePreference,
	THEME_PREFERENCE_COOKIE,
} from "$lib/utils/theme/themePreference";
import { env } from "$env/dynamic/private";
import {
	redirect,
	error,
	json,
	type Handle,
	type HandleServerError,
} from "@sveltejs/kit";

const finalizeResponse = (
	response: Response,
	url: URL,
	isAuthenticated: boolean,
) => {
	applySecurityHeaders(response, url, isAuthenticated);
	response.headers.set("x-blendcalc-app-version", APP_VERSION);
	response.headers.set("x-blendcalc-app-build", APP_BUILD_VERSION);
	return response;
};

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
			if (
				event.url.pathname !== "/auth/logout" ||
				event.request.method !== "POST"
			) {
				throw error(
					503,
					createAppIssuePayload("MODERATION_DATA_UNAVAILABLE"),
				);
			}
		} else if (
			moderation &&
			isActiveAccountBlock(moderation.status, moderation.expires_at)
		) {
			await event.locals.supabase.auth.signOut({ scope: "local" });
			throw redirect(303, "/auth?error=account_blocked");
		}
	}

	const rateLimitPolicy = getRequestRateLimitPolicy(
		event.request.method,
		event.url.pathname,
	);
	if (rateLimitPolicy) {
		let clientAddress = "unavailable";
		try {
			clientAddress = event.getClientAddress();
		} catch {
			// The authenticated user id remains the primary subject in hosted runtime.
		}
		const subject = user
			? `user:${user.id}`
			: `client:${clientAddress}`;
		try {
			const rateLimit = await consumeRequestRateLimit({
				policy: rateLimitPolicy,
				subject,
			});
			if (!rateLimit.allowed) {
				const response = json(createAppIssuePayload("RATE_LIMITED"), {
					status: 429,
					headers: {
						"retry-after": String(rateLimit.retryAfterSeconds),
						"x-ratelimit-remaining": "0",
					},
				});
				return finalizeResponse(response, event.url, Boolean(user));
			}
		} catch (rateLimitError) {
			console.error("[security] Request rate limit unavailable", {
				path: event.url.pathname,
				method: event.request.method,
				error: rateLimitError instanceof Error
					? rateLimitError.message
					: typeof rateLimitError,
			});
			const response = json(createAppIssuePayload("SERVICE_UNAVAILABLE"), {
				status: 503,
			});
			return finalizeResponse(response, event.url, Boolean(user));
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
						`<meta name="theme-color" content="${LIGHT_THEME_COLOR}"/>`,
						`<meta name="theme-color" content="${DARK_THEME_COLOR}"/>`,
					)
				: themedHtml;
		},
	});

	return finalizeResponse(response, event.url, Boolean(user));
};
