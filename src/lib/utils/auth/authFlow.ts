import type { Cookies } from "@sveltejs/kit";

const AUTH_NEXT_COOKIE = "smoothie-auth-next";
const AUTH_ORIGIN_COOKIE = "smoothie-auth-origin";
const AUTH_FLOW_ID_COOKIE = "smoothie-auth-flow-id";
const AUTH_FLOW_MAX_AGE_SECONDS = 60 * 10;

export const getSafeAuthNextPath = (
	value: FormDataEntryValue | string | null | undefined,
) => {
	if (typeof value !== "string" || !value.startsWith("/")) return "/";
	if (value.startsWith("//")) return "/";
	return value;
};

const getAuthCookieOptions = (url: URL) => ({
	path: "/",
	httpOnly: true,
	sameSite: "lax" as const,
	secure: url.protocol === "https:",
	maxAge: AUTH_FLOW_MAX_AGE_SECONDS,
});

export const storeAuthFlowContext = (cookies: Cookies, next: string, url: URL) => {
	const options = getAuthCookieOptions(url);
	const flowId = crypto.randomUUID();
	cookies.set(AUTH_NEXT_COOKIE, getSafeAuthNextPath(next), options);
	cookies.set(AUTH_ORIGIN_COOKIE, url.origin, options);
	cookies.set(AUTH_FLOW_ID_COOKIE, flowId, options);
	return flowId;
};

export const clearAuthFlowContext = (cookies: Cookies) => {
	cookies.delete(AUTH_NEXT_COOKIE, { path: "/" });
	cookies.delete(AUTH_ORIGIN_COOKIE, { path: "/" });
	cookies.delete(AUTH_FLOW_ID_COOKIE, { path: "/" });
};

export const consumeAuthFlowContext = (cookies: Cookies) => {
	const context = {
		next: getSafeAuthNextPath(cookies.get(AUTH_NEXT_COOKIE)),
		origin: cookies.get(AUTH_ORIGIN_COOKIE) ?? null,
		flowId: cookies.get(AUTH_FLOW_ID_COOKIE) ?? null,
	};
	clearAuthFlowContext(cookies);
	return context;
};

export const getAuthCallbackFailureUrl = (
	error: string,
	next: string,
) => {
	const params = new URLSearchParams({
		error,
		next: getSafeAuthNextPath(next),
	});
	return `/auth?${params.toString()}`;
};
