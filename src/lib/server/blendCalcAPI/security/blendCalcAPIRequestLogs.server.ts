import { createHmac } from "node:crypto";
import { env } from "$env/dynamic/private";
import { getBlendCalcAPIIsolatedClient } from "$lib/server/blendCalcAPI/v1/blendCalcAPIIsolatedClient.server";

export type BlendCalcAPIRequestActorType =
	"authenticated-user" | "api-key" | "anonymous";

export type BlendCalcAPIRateLimitResult =
	"allowed" | "denied" | "unavailable" | "not-evaluated";

export type BlendCalcAPISafeEndpoint =
	| "/api/v1/categories"
	| "/api/v1/foods/search"
	| "/api/v1/products/{barcode}"
	| "/api/v1/products/{barcode}/revisions"
	| "/api/v1/{unknown}";

export const readBlendCalcAPISafeEndpoint = (
	pathname: string,
): BlendCalcAPISafeEndpoint => {
	const safePathname = pathname.split(/[?#]/, 1)[0];
	if (safePathname === "/api/v1/categories") return safePathname;
	if (safePathname === "/api/v1/foods/search") return safePathname;
	if (/^\/api\/v1\/products\/[^/]+\/revisions$/.test(safePathname)) {
		return "/api/v1/products/{barcode}/revisions";
	}
	if (/^\/api\/v1\/products\/[^/]+$/.test(safePathname)) {
		return "/api/v1/products/{barcode}";
	}
	return "/api/v1/{unknown}";
};

export const readBlendCalcAPISafeMethod = (method: string) => {
	const normalized = method.toUpperCase();
	return ["GET", "HEAD", "OPTIONS", "POST", "PATCH", "DELETE"].includes(
		normalized,
	)
		? normalized
		: "OTHER";
};

const hashActorIdentity = (
	actorType: Exclude<BlendCalcAPIRequestActorType, "anonymous">,
	actorIdentifier: string,
) => {
	const key = env.BLENDCALC_API_SUPABASE_SERVICE_ROLE_KEY?.trim();
	if (!key) {
		throw new Error("The isolated blendCalcAPI logging key is not configured.");
	}
	return createHmac("sha256", key)
		.update("blendcalc/api-request-actor/v1\0")
		.update(actorType)
		.update("\0")
		.update(actorIdentifier)
		.digest("hex");
};

export const createBlendCalcAPISafeActor = (
	actorIdentifier: string | null,
): { actorType: BlendCalcAPIRequestActorType; actorHash: string | null } =>
	actorIdentifier
		? {
				actorType: "authenticated-user",
				actorHash: hashActorIdentity("authenticated-user", actorIdentifier),
			}
		: { actorType: "anonymous", actorHash: null };

export const recordBlendCalcAPISafeRequest = async (input: {
	requestId: string;
	pathname: string;
	method: string;
	responseStatus: number;
	durationMs: number;
	actorIdentifier: string | null;
	rateLimitResult: BlendCalcAPIRateLimitResult;
}) => {
	try {
		const actor = createBlendCalcAPISafeActor(input.actorIdentifier);
		const { error } = await getBlendCalcAPIIsolatedClient().rpc(
			"record_safe_request_log",
			{
				p_request_id: input.requestId,
				p_endpoint: readBlendCalcAPISafeEndpoint(input.pathname),
				p_method: readBlendCalcAPISafeMethod(input.method),
				p_response_status: input.responseStatus,
				p_duration_ms: Math.max(0, input.durationMs),
				p_actor_type: actor.actorType,
				p_rate_limit_result: input.rateLimitResult,
				...(actor.actorHash ? { p_actor_hash: actor.actorHash } : {}),
			},
		);
		if (error) throw error;
	} catch (error) {
		console.error("[blendCalcAPI] Safe request log failed", {
			errorType: error instanceof Error ? error.name : typeof error,
		});
	}
};
