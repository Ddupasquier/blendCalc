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

const getForwardedRequestOrigin = (request: Request, fallbackUrl: URL) => {
	const forwardedHost = request.headers
		.get("x-forwarded-host")
		?.split(",")[0]
		?.trim();
	if (!forwardedHost) return "";

	const forwardedProtocol = request.headers
		.get("x-forwarded-proto")
		?.split(",")[0]
		?.trim();
	const protocol = forwardedProtocol || fallbackUrl.protocol.replace(":", "");
	return normalizeConfiguredOrigin(`${protocol}://${forwardedHost}`);
};

export const getExternalRequestOrigin = (
	request: Request,
	fallbackUrl: URL,
) => {
	return getForwardedRequestOrigin(request, fallbackUrl) || fallbackUrl.origin;
};

export const getRequestOrigin = (request: Request, fallbackUrl: URL) => {
	const forwardedOrigin = getExternalRequestOrigin(request, fallbackUrl);
	const requestOrigins = [forwardedOrigin, fallbackUrl.origin].filter(Boolean);
	const localOrigin = requestOrigins.find(isLocalOrigin);
	if (localOrigin) return localOrigin;

	const configuredOrigin = normalizeConfiguredOrigin(env.PUBLIC_SITE_URL);
	const vercelRequestOrigin = requestOrigins.find(
		isCurrentVercelDeploymentOrigin,
	);
	if (vercelRequestOrigin) return vercelRequestOrigin;

	const configuredRequestOrigin = requestOrigins.find(
		(origin) => origin === configuredOrigin,
	);
	if (configuredRequestOrigin) return configuredRequestOrigin;
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
	if (canonicalOrigin === getExternalRequestOrigin(request, fallbackUrl)) {
		return null;
	}

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
