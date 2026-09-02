import { createSupabaseServerClient } from "$lib/supabase/server";
import { randomUUID } from "node:crypto";
import { readVerifiedAuthUser } from "$lib/server/auth/verifiedAuthUser.server";
import { applySecurityHeaders } from "$lib/utils/http/securityHeaders";
import { isActiveAccountBlock } from "$lib/utils/moderation/moderation";
import { APP_BUILD_VERSION, APP_VERSION } from "$lib/config/version";
import { createAppIssuePayload } from "$lib/utils/errors/appIssues";
import { isBlendCalcAPIV1Pathname } from "$lib/blendCalcAPI/v1/blendCalcAPIErrors";
import {
	blendCalcAPIV1Error,
	normalizeBlendCalcAPIV1BoundaryResponse,
} from "$lib/server/blendCalcAPI/v1/blendCalcAPIHttp.server";
import {
	consumeRequestRateLimits,
	getRequestRateLimitLayers,
} from "$lib/server/security/requestRateLimit.server";
import {
	readBlendCalcAPISafeEndpoint,
	recordBlendCalcAPISafeRequest,
	type BlendCalcAPIRateLimitResult,
} from "$lib/server/blendCalcAPI/security/blendCalcAPIRequestLogs.server";
import { completeServerBackgroundTask } from "$lib/server/runtime/backgroundTask.server";
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
	const technicalError =
		requestError instanceof Error
			? { name: requestError.name }
			: { type: typeof requestError };
	console.error("[request] Unexpected server error", {
		method,
		path: isBlendCalcAPIV1Pathname(path)
			? readBlendCalcAPISafeEndpoint(path)
			: path,
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
	const requestId = randomUUID();
	const requestStartedAt = performance.now();
	let rateLimitResult: BlendCalcAPIRateLimitResult = "not-evaluated";
	const finalizeHandledResponse = async (
		response: Response,
		actorIdentifier: string | null,
	) => {
		const normalizedResponse = finalizeResponse(
			normalizeBlendCalcAPIV1BoundaryResponse(event.url.pathname, response),
			event.url,
			Boolean(actorIdentifier),
		);
		if (isBlendCalcAPIV1Pathname(event.url.pathname)) {
			normalizedResponse.headers.set("x-request-id", requestId);
			await completeServerBackgroundTask(
				recordBlendCalcAPISafeRequest({
					requestId,
					pathname: event.url.pathname,
					method: event.request.method,
					responseStatus: normalizedResponse.status,
					durationMs: performance.now() - requestStartedAt,
					actorIdentifier,
					rateLimitResult,
				}),
			);
		}
		return normalizedResponse;
	};

	event.locals.supabase = createSupabaseServerClient(event.cookies);

	let authResult: ReturnType<App.Locals["getVerifiedUser"]> | null = null;
	event.locals.getVerifiedUser = () => {
		authResult ??= readVerifiedAuthUser(event.locals.supabase, {
			requireCurrentAuthRecord: env.BLENDCALC_DATABASE_ENVIRONMENT === "test",
		});
		return authResult;
	};

	const user = await event.locals.getVerifiedUser();
	event.locals.user = user;

	if (user) {
		const { data: moderation, error: moderationError } =
			await event.locals.supabase
				.from("account_moderation")
				.select("status, expires_at")
				.eq("user_id", user.id)
				.maybeSingle();

		if (moderationError) {
			console.error("[moderation] Unable to verify account status", {
				requestId,
				actorType: "authenticated-user",
				code: moderationError.code,
			});
			if (
				event.url.pathname !== "/auth/logout" ||
				event.request.method !== "POST"
			) {
				if (isBlendCalcAPIV1Pathname(event.url.pathname)) {
					return finalizeHandledResponse(
						blendCalcAPIV1Error("service_unavailable"),
						user.id,
					);
				}
				throw error(503, createAppIssuePayload("MODERATION_DATA_UNAVAILABLE"));
			}
		} else if (
			moderation &&
			isActiveAccountBlock(moderation.status, moderation.expires_at)
		) {
			await event.locals.supabase.auth.signOut({ scope: "local" });
			if (isBlendCalcAPIV1Pathname(event.url.pathname)) {
				return finalizeHandledResponse(
					blendCalcAPIV1Error("access_denied"),
					user.id,
				);
			}
			throw redirect(303, "/auth?error=account_blocked");
		}
	}

	const rateLimitLayers = getRequestRateLimitLayers({
		apiKey: event.request.headers.get("x-blendcalc-api-key"),
		clientAddress: (() => {
			try {
				return event.getClientAddress();
			} catch {
				return "unavailable";
			}
		})(),
		method: event.request.method,
		pathname: event.url.pathname,
		userId: user?.id,
	});
	if (rateLimitLayers.length > 0) {
		try {
			const rateLimit = await consumeRequestRateLimits(rateLimitLayers);
			rateLimitResult = rateLimit.allowed ? "allowed" : "denied";
			if (!rateLimit.allowed) {
				const response = isBlendCalcAPIV1Pathname(event.url.pathname)
					? blendCalcAPIV1Error("rate_limited", undefined, {
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
				return finalizeHandledResponse(response, user?.id ?? null);
			}
		} catch (rateLimitError) {
			rateLimitResult = "unavailable";
			console.error("[security] Request rate limit unavailable", {
				requestId,
				path: isBlendCalcAPIV1Pathname(event.url.pathname)
					? readBlendCalcAPISafeEndpoint(event.url.pathname)
					: event.url.pathname,
				method: event.request.method,
				errorType:
					rateLimitError instanceof Error
						? rateLimitError.name
						: typeof rateLimitError,
			});
			const response = isBlendCalcAPIV1Pathname(event.url.pathname)
				? blendCalcAPIV1Error("service_unavailable")
				: json(createAppIssuePayload("SERVICE_UNAVAILABLE"), {
						status: 503,
					});
			return finalizeHandledResponse(response, user?.id ?? null);
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
		if (!isBlendCalcAPIV1Pathname(event.url.pathname)) throw requestError;
		logUnexpectedRequestError({
			error: requestError,
			method: event.request.method,
			path: event.url.pathname,
			status: 500,
		});
		response = blendCalcAPIV1Error("unexpected_error");
	}

	return finalizeHandledResponse(response, user?.id ?? null);
};
