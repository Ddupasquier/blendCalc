import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
	consumeAuthFlowContext,
	getAuthCallbackFailureUrl,
	getSafeAuthNextPath,
} from "$lib/utils/auth/authFlow";
import { getRequestOrigin } from "$lib/utils/auth/authUrls";
import { trackServerAppInteraction } from "$lib/server/analytics/appInteractionTracking.server";
import { APP_INTERACTION_METRICS } from "$lib/utils/analytics/appInteractionMetrics";

export const GET: RequestHandler = async ({ locals, request, url, cookies }) => {
	const code = url.searchParams.get("code");
	const flowContext = consumeAuthFlowContext(cookies);
	const next = flowContext.flowId
		? flowContext.next
		: getSafeAuthNextPath(url.searchParams.get("next"));
	const { origin: expectedOrigin, flowId } = flowContext;
	const providerError = url.searchParams.get("error_description");
	const actualOrigin = getRequestOrigin(request, url);

	if (expectedOrigin && expectedOrigin !== actualOrigin) {
		console.warn("[auth] OAuth callback returned to the wrong origin", {
			flowId,
			expectedOrigin,
			actualOrigin,
		});
		throw redirect(303, getAuthCallbackFailureUrl("wrong_origin", next));
	}

	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);

		if (!error) {
			await trackServerAppInteraction(
				APP_INTERACTION_METRICS.LOGIN_SUCCESS,
				request,
			);
			throw redirect(303, next);
		}

		console.warn("[auth] OAuth code exchange failed", {
			flowId,
			origin: actualOrigin,
			expectedOrigin,
			hadFlowCookie: Boolean(expectedOrigin),
			message: error.message,
			status: error.status,
			code: error.code,
		});

		throw redirect(303, getAuthCallbackFailureUrl("callback_exchange", next));
	}

	const errorCode = providerError ? "provider" : "missing_code";
	console.warn("[auth] OAuth callback did not include a code", {
		flowId,
		origin: actualOrigin,
		errorCode,
		providerError: providerError ?? null,
	});
	throw redirect(303, getAuthCallbackFailureUrl(errorCode, next));
};
