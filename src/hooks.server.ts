import { createSupabaseServerClient } from "$lib/supabase/server";
import { readVerifiedAuthUser } from "$lib/server/auth/verifiedAuthUser.server";
import { applySecurityHeaders } from "$lib/utils/http/securityHeaders";
import { isActiveAccountBlock } from "$lib/utils/moderation/moderation";
import { APP_BUILD_VERSION, APP_VERSION } from "$lib/config/version";
import { createAppIssuePayload } from "$lib/utils/errors/appIssues";
import { isApiV1Pathname } from "$lib/api/v1/errors";
import {
	apiV1Error,
	normalizeApiV1BoundaryResponse,
} from "$lib/server/api/v1/http.server";
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

const logUnexpectedRequestError = ({
	error: requestError,
	method,
	path,
	status,
}: {
	error: unknown;
	method: string;
	path: string;
	status: number;
}) => {
	const technicalError = requestError instanceof Error
		? { name: requestError.name, message: requestError.message }
		: { type: typeof requestError };
	console.error("[request] Unexpected server error", {
		method,
		path,
		status,
		error: technicalError,
	});
};

export const handleError: HandleServerError = ({ error, event, status }) => {
	logUnexpectedRequestError({
		error,
		method: event.request.method,
		path: event.url.pathname,
		status,
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
				if (isApiV1Pathname(event.url.pathname)) {
					return finalizeResponse(
						apiV1Error("service_unavailable"),
						event.url,
						true,
					);
				}
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
			if (isApiV1Pathname(event.url.pathname)) {
				return finalizeResponse(
					apiV1Error("access_denied"),
					event.url,
					true,
				);
			}
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
				const response = isApiV1Pathname(event.url.pathname)
					? apiV1Error("rate_limited", undefined, {
						"retry-after": String(rateLimit.retryAfterSeconds),
						"x-ratelimit-remaining": "0",
					})
					: json(createAppIssuePayload("RATE_LIMITED"), {
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
			const response = isApiV1Pathname(event.url.pathname)
				? apiV1Error("service_unavailable")
				: json(createAppIssuePayload("SERVICE_UNAVAILABLE"), {
					status: 503,
				});
			return finalizeResponse(response, event.url, Boolean(user));
		}
	}

	let response: Response;
	try {
		response = await resolve(event, {
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
	} catch (requestError) {
		if (!isApiV1Pathname(event.url.pathname)) throw requestError;
		logUnexpectedRequestError({
			error: requestError,
			method: event.request.method,
			path: event.url.pathname,
			status: 500,
		});
		response = apiV1Error("unexpected_error");
	}

	return finalizeResponse(
		normalizeApiV1BoundaryResponse(event.url.pathname, response),
		event.url,
		Boolean(user),
	);
};
