import { createHmac } from "node:crypto";
import { env } from "$env/dynamic/private";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";

export type RequestRateLimitPolicy = {
	scope: string;
	limit: number;
	windowSeconds: number;
};

const API_DEFAULT_POLICY: RequestRateLimitPolicy = {
	scope: "api:default",
	limit: 240,
	windowSeconds: 60,
};

export const getRequestRateLimitPolicy = (
	method: string,
	pathname: string,
): RequestRateLimitPolicy | null => {
	const requestMethod = method.toUpperCase();

	if (requestMethod === "POST" && pathname === "/auth") {
		return {
			scope: "auth:action",
			limit: 30,
			windowSeconds: 15 * 60,
		};
	}
	if (requestMethod === "POST" && pathname === "/auth/update-password") {
		return {
			scope: "auth:password-update",
			limit: 10,
			windowSeconds: 60 * 60,
		};
	}
	if (requestMethod === "POST" && pathname === "/profile") {
		return {
			scope: "profile:action",
			limit: 120,
			windowSeconds: 10 * 60,
		};
	}
	if (requestMethod === "POST" && pathname === "/moderation") {
		return {
			scope: "moderation:action",
			limit: 120,
			windowSeconds: 60,
		};
	}

	if (!pathname.startsWith("/api/")) return null;
	if (pathname.startsWith("/api/internal/")) return null;

	if (pathname === "/api/products/submissions" && requestMethod === "POST") {
		return {
			scope: "catalog:submission",
			limit: 10,
			windowSeconds: 3600,
		};
	}
	if (pathname === "/api/publication-concerns" && requestMethod === "POST") {
		return {
			scope: "blendCalcAPI:publication-concern",
			limit: 10,
			windowSeconds: 60 * 60,
		};
	}
	if (pathname.startsWith("/api/products/barcode/")) {
		return {
			scope: "catalog:barcode",
			limit: 60,
			windowSeconds: 600,
		};
	}
	if (pathname === "/api/foods/search" && requestMethod === "GET") {
		return {
			scope: "food:search",
			limit: 180,
			windowSeconds: 60,
		};
	}
	if (
		pathname === "/api/food-compatibility/feedback" &&
		requestMethod === "POST"
	) {
		return {
			scope: "compatibility:feedback",
			limit: 30,
			windowSeconds: 3600,
		};
	}
	if (pathname === "/api/food-images/crop" && requestMethod === "PATCH") {
		return {
			scope: "food-image:placement",
			limit: 60,
			windowSeconds: 60,
		};
	}
	if (
		pathname.startsWith("/api/user-food-lists/") &&
		(requestMethod === "POST" || requestMethod === "DELETE")
	) {
		return {
			scope: "food-list:write",
			limit: 120,
			windowSeconds: 60,
		};
	}
	if (pathname.startsWith("/api/v1/") && requestMethod === "GET") {
		return {
			scope: "api-v1:read",
			limit: 180,
			windowSeconds: 60,
		};
	}

	return {
		...API_DEFAULT_POLICY,
		scope: `${API_DEFAULT_POLICY.scope}:${requestMethod.toLowerCase()}`,
	};
};

const hashSubject = (value: string) => {
	const key = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
	return createHmac("sha256", key)
		.update("blendcalc/request-rate-limit/v1\0")
		.update(value)
		.digest("hex");
};

export const consumeRequestRateLimit = async ({
	policy,
	subject,
}: {
	policy: RequestRateLimitPolicy;
	subject: string;
}) => {
	const { data, error } = await getSupabaseAdminClient().rpc(
		"consume_request_rate_limit",
		{
			p_limit: policy.limit,
			p_scope: policy.scope,
			p_subject_hash: hashSubject(subject),
			p_window_seconds: policy.windowSeconds,
		},
	);
	if (error) throw error;
	const result = data?.[0];
	if (!result)
		throw new Error("The request rate limit did not return a result.");
	return {
		allowed: result.allowed,
		remaining: result.remaining,
		retryAfterSeconds: result.retry_after_seconds,
	};
};
