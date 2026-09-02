import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	rpc: vi.fn(),
}));

vi.mock("$env/dynamic/private", () => ({
	env: { BLENDCALC_API_SUPABASE_SERVICE_ROLE_KEY: "isolated-service-key" },
}));
vi.mock(
	"$lib/server/blendCalcAPI/v1/blendCalcAPIIsolatedClient.server",
	() => ({ getBlendCalcAPIIsolatedClient: () => ({ rpc: mocks.rpc }) }),
);

import {
	createBlendCalcAPISafeActor,
	readBlendCalcAPISafeEndpoint,
	readBlendCalcAPISafeMethod,
	recordBlendCalcAPISafeRequest,
} from "../../../../src/lib/server/blendCalcAPI/security/blendCalcAPIRequestLogs.server";

describe("privacy-safe blendCalcAPI request logs", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.rpc.mockResolvedValue({ error: null });
	});

	it("reduces routes to endpoint templates without retaining identifiers", () => {
		expect(
			readBlendCalcAPISafeEndpoint("/api/v1/products/00011110863065/revisions"),
		).toBe("/api/v1/products/{barcode}/revisions");
		expect(
			readBlendCalcAPISafeEndpoint("/api/v1/products/00011110863065"),
		).toBe("/api/v1/products/{barcode}");
		expect(readBlendCalcAPISafeEndpoint("/api/v1/private/value")).toBe(
			"/api/v1/{unknown}",
		);
	});

	it("normalizes request methods to a bounded safe set", () => {
		expect(readBlendCalcAPISafeMethod("get")).toBe("GET");
		expect(readBlendCalcAPISafeMethod("TRACE")).toBe("OTHER");
	});

	it("creates stable pseudonyms without returning raw actor identities", () => {
		const first = createBlendCalcAPISafeActor("private-user-id");
		const repeated = createBlendCalcAPISafeActor("private-user-id");
		const different = createBlendCalcAPISafeActor("other-user-id");
		expect(first).toEqual(repeated);
		expect(first.actorHash).toMatch(/^[0-9a-f]{64}$/);
		expect(first.actorHash).not.toContain("private-user-id");
		expect(first.actorHash).not.toBe(different.actorHash);
		expect(createBlendCalcAPISafeActor(null)).toEqual({
			actorType: "anonymous",
			actorHash: null,
		});
	});

	it("writes only normalized request metadata to the isolated database", async () => {
		await recordBlendCalcAPISafeRequest({
			requestId: "00000000-0000-0000-0000-000000000201",
			pathname: "/api/v1/products/00011110863065?secret=value",
			method: "GET",
			responseStatus: 200,
			durationMs: 8.25,
			actorIdentifier: "private-user-id",
			rateLimitResult: "allowed",
		});
		expect(mocks.rpc).toHaveBeenCalledWith("record_safe_request_log", {
			p_request_id: "00000000-0000-0000-0000-000000000201",
			p_endpoint: "/api/v1/products/{barcode}",
			p_method: "GET",
			p_response_status: 200,
			p_duration_ms: 8.25,
			p_actor_type: "authenticated-user",
			p_actor_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
			p_rate_limit_result: "allowed",
		});
		expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain(
			"private-user-id",
		);
		expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain("secret=value");
		expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain(
			"00011110863065",
		);
	});

	it("contains logging failures without exposing database details", async () => {
		mocks.rpc.mockResolvedValue({
			error: new Error("private database credential detail"),
		});
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		await expect(
			recordBlendCalcAPISafeRequest({
				requestId: "00000000-0000-0000-0000-000000000202",
				pathname: "/api/v1/categories",
				method: "GET",
				responseStatus: 503,
				durationMs: 1,
				actorIdentifier: null,
				rateLimitResult: "unavailable",
			}),
		).resolves.toBeUndefined();
		expect(consoleError).toHaveBeenCalledWith(
			"[blendCalcAPI] Safe request log failed",
			{ errorType: "Error" },
		);
		expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
			"private database credential detail",
		);
		consoleError.mockRestore();
	});
});
