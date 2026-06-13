import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
	consumeAuthFlowContext,
	getAuthCallbackFailureUrl,
	getSafeAuthNextPath,
} from "$lib/utils/auth/authFlow";

export const GET: RequestHandler = async ({ locals, url, cookies }) => {
	const code = url.searchParams.get("code");
	const flowContext = consumeAuthFlowContext(cookies);
	const next = flowContext.flowId
		? flowContext.next
		: getSafeAuthNextPath(url.searchParams.get("next"));
	const { origin: expectedOrigin, flowId } = flowContext;
	const providerError = url.searchParams.get("error_description");

	if (expectedOrigin && expectedOrigin !== url.origin) {
		console.warn("[auth] OAuth callback returned to the wrong origin", {
			flowId,
			expectedOrigin,
			actualOrigin: url.origin,
		});
		throw redirect(303, getAuthCallbackFailureUrl("wrong_origin", next));
	}

	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);

		if (!error) {
			throw redirect(303, next);
		}

		console.warn("[auth] OAuth code exchange failed", {
			flowId,
			origin: url.origin,
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
		origin: url.origin,
		errorCode,
		providerError: providerError ?? null,
	});
	throw redirect(303, getAuthCallbackFailureUrl(errorCode, next));
};
