import { env } from "$env/dynamic/public";
import { env as privateEnv } from "$env/dynamic/private";

const normalizeConfiguredOrigin = (value: string | undefined) => {
	if (!value) return "";

	try {
		const url = new URL(value.includes("://") ? value : `https://${value}`);
		if (url.protocol !== "http:" && url.protocol !== "https:") return "";
		return url.origin;
	} catch {
		return "";
	}
};

export const isLocalOrigin = (origin: string) => {
	try {
		const { hostname } = new URL(origin);
		return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
	} catch {
		return false;
	}
};

const getVercelDeploymentOrigins = () => {
	return [
		privateEnv.VERCEL_URL,
		privateEnv.VERCEL_BRANCH_URL,
		privateEnv.VERCEL_PROJECT_PRODUCTION_URL,
	]
		.map(normalizeConfiguredOrigin)
		.filter((origin): origin is string => Boolean(origin));
};

export const isCurrentVercelDeploymentOrigin = (origin: string) => {
	return getVercelDeploymentOrigins().includes(origin);
};

export const getRequestOrigin = (request: Request, fallbackUrl: URL) => {
	void request;
	if (isLocalOrigin(fallbackUrl.origin)) return fallbackUrl.origin;

	const configuredOrigin = normalizeConfiguredOrigin(env.PUBLIC_SITE_URL);
	if (fallbackUrl.origin === configuredOrigin) return fallbackUrl.origin;
	if (isCurrentVercelDeploymentOrigin(fallbackUrl.origin)) {
		return fallbackUrl.origin;
	}
	if (configuredOrigin) return configuredOrigin;

	throw new Error(
		"PUBLIC_SITE_URL must be configured for hosted authentication requests.",
	);
};

export const getCanonicalAuthPageUrl = (
	request: Request,
	fallbackUrl: URL,
	next: string,
) => {
	const canonicalOrigin = getRequestOrigin(request, fallbackUrl);
	if (canonicalOrigin === fallbackUrl.origin) return null;

	const url = new URL("/auth", canonicalOrigin);
	url.searchParams.set("next", next);
	return url.toString();
};

export const getAuthCallbackUrl = (
	request: Request,
	fallbackUrl: URL,
) => {
	return new URL(
		"/auth/callback",
		getRequestOrigin(request, fallbackUrl),
	).toString();
};
