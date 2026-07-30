export const APP_INTERACTION_METRICS = {
	LOGIN_SUCCESS: "auth_login_success",
	LOGOUT_SUCCESS: "auth_logout_success",
	PAGE_RELOAD: "page_reload",
	PAGE_VIEW: "page_view",
} as const;

export type AppInteractionMetric =
	(typeof APP_INTERACTION_METRICS)[keyof typeof APP_INTERACTION_METRICS];

export const VERCEL_CUSTOM_INTERACTION_METRICS = [
	APP_INTERACTION_METRICS.LOGIN_SUCCESS,
	APP_INTERACTION_METRICS.LOGOUT_SUCCESS,
	APP_INTERACTION_METRICS.PAGE_RELOAD,
] as const;
