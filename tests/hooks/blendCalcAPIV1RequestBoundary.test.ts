import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectBlendCalcAPIV1ResponseToMatchOpenAPI } from "../lib/blendCalcAPI/v1/openAPIResponseValidation";

const mocks = vi.hoisted(() => {
	const moderationQuery = {
		select: vi.fn(),
		eq: vi.fn(),
		maybeSingle: vi.fn(),
	};
	moderationQuery.select.mockReturnValue(moderationQuery);
	moderationQuery.eq.mockReturnValue(moderationQuery);

	return {
		applySecurityHeaders: vi.fn(),
		consumeRequestRateLimits: vi.fn(),
		createSupabaseServerClient: vi.fn(),
		completeServerBackgroundTask: vi.fn(),
		getRequestRateLimitLayers: vi.fn(),
		isActiveAccountBlock: vi.fn(),
		moderationQuery,
		recordBlendCalcAPIRequestObservation: vi.fn(),
		readVerifiedAuthUser: vi.fn(),
		recordBlendCalcAPISafeRequest: vi.fn(),
		signOut: vi.fn(),
	};
});

vi.mock("$env/dynamic/private", () => ({ env: {} }));
vi.mock("$lib/config/version", () => ({
	APP_BUILD_VERSION: "1.0.0+test",
	APP_VERSION: "1.0.0",
}));
vi.mock("$lib/supabase/server", () => ({
	createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock("$lib/server/auth/verifiedAuthUser.server", () => ({
	readVerifiedAuthUser: mocks.readVerifiedAuthUser,
}));
vi.mock("$lib/server/security/requestRateLimit.server", () => ({
	consumeRequestRateLimits: mocks.consumeRequestRateLimits,
	getRequestRateLimitLayers: mocks.getRequestRateLimitLayers,
}));
vi.mock(
	"$lib/server/blendCalcAPI/security/blendCalcAPIRequestLogs.server",
	() => ({
		readBlendCalcAPISafeEndpoint: (pathname: string) =>
			pathname.startsWith("/api/v1/products/")
				? "/api/v1/products/{barcode}"
				: pathname,
		recordBlendCalcAPISafeRequest: mocks.recordBlendCalcAPISafeRequest,
	}),
);
vi.mock(
	"$lib/server/blendCalcAPI/operations/blendCalcAPIOperations.server",
	() => ({
		recordBlendCalcAPIRequestObservation:
			mocks.recordBlendCalcAPIRequestObservation,
	}),
);
vi.mock("$lib/server/runtime/backgroundTask.server", () => ({
	completeServerBackgroundTask: mocks.completeServerBackgroundTask,
}));
vi.mock("$lib/utils/http/securityHeaders", () => ({
	applySecurityHeaders: mocks.applySecurityHeaders,
}));
vi.mock("$lib/utils/moderation/moderation", () => ({
	isActiveAccountBlock: mocks.isActiveAccountBlock,
}));
vi.mock("$lib/utils/theme/themePreference", () => ({
	DARK_THEME_COLOR: "#11141c",
	LIGHT_THEME_COLOR: "#f8f8fb",
	THEME_PREFERENCE_COOKIE: "blendcalc-theme",
	normalizeThemePreference: () => "system",
}));

import { handle } from "../../src/hooks.server";

const API_PATH = "/api/v1/categories";

const createEvent = (pathname = API_PATH) => {
	const url = new URL(`http://localhost${pathname}`);
	return {
		cookies: {
			get: vi.fn(),
			getAll: vi.fn(() => []),
			set: vi.fn(),
		},
		getClientAddress: vi.fn(() => "127.0.0.1"),
		locals: {} as Partial<App.Locals>,
		request: new Request(url),
		url,
	};
};

describe("blendCalcAPI v1 server request boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.createSupabaseServerClient.mockReturnValue({
			auth: { signOut: mocks.signOut },
			from: vi.fn(() => mocks.moderationQuery),
		});
		mocks.readVerifiedAuthUser.mockResolvedValue(null);
		mocks.recordBlendCalcAPISafeRequest.mockResolvedValue(undefined);
		mocks.recordBlendCalcAPIRequestObservation.mockResolvedValue(undefined);
		mocks.completeServerBackgroundTask.mockImplementation(async (task) => {
			await task;
		});
		mocks.getRequestRateLimitLayers.mockReturnValue([
			{
				limit: 180,
				scope: "api-v1:read:ip:burst",
				subject: "client:127.0.0.1",
				windowSeconds: 60,
			},
		]);
		mocks.consumeRequestRateLimits.mockResolvedValue({
			allowed: true,
			remaining: 179,
			retryAfterSeconds: 0,
		});
		mocks.moderationQuery.maybeSingle.mockResolvedValue({
			data: null,
			error: null,
		});
		mocks.isActiveAccountBlock.mockReturnValue(false);
	});

	it("returns a documented API error when the request is rate limited", async () => {
		mocks.consumeRequestRateLimits.mockResolvedValue({
			allowed: false,
			remaining: 0,
			retryAfterSeconds: 14,
		});
		const response = await handle({
			event: createEvent(),
			resolve: vi.fn(),
		} as never);
		expect(response.status).toBe(429);
		expect(response.headers.get("retry-after")).toBe("14");
		expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
		expect(mocks.recordBlendCalcAPIRequestObservation).toHaveBeenCalledWith(
			expect.objectContaining({
				pathname: API_PATH,
				responseStatus: 429,
			}),
		);
		const payload = await expectBlendCalcAPIV1ResponseToMatchOpenAPI({
			path: API_PATH,
			response,
		});
		expect(payload).toMatchObject({ error: { code: "rate_limited" } });
		expect(mocks.recordBlendCalcAPISafeRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				actorIdentifier: null,
				pathname: API_PATH,
				rateLimitResult: "denied",
				responseStatus: 429,
			}),
		);
	});

	it("returns a documented API error when rate-limit storage fails", async () => {
		mocks.consumeRequestRateLimits.mockRejectedValue(
			new Error("private rate-limit database detail"),
		);
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const response = await handle({
			event: createEvent(),
			resolve: vi.fn(),
		} as never);
		expect(response.status).toBe(503);
		const payload = await expectBlendCalcAPIV1ResponseToMatchOpenAPI({
			path: API_PATH,
			response,
		});
		expect(payload).toMatchObject({ error: { code: "service_unavailable" } });
		expect(JSON.stringify(payload)).not.toContain(
			"private rate-limit database detail",
		);
		expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
			"private rate-limit database detail",
		);
		consoleError.mockRestore();
		expect(mocks.recordBlendCalcAPISafeRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				rateLimitResult: "unavailable",
				responseStatus: 503,
			}),
		);
	});

	it("returns a documented forbidden response for a blocked account", async () => {
		mocks.readVerifiedAuthUser.mockResolvedValue({ id: "blocked-user" });
		mocks.moderationQuery.maybeSingle.mockResolvedValue({
			data: { expires_at: null, status: "banned" },
			error: null,
		});
		mocks.isActiveAccountBlock.mockReturnValue(true);
		const response = await handle({
			event: createEvent(),
			resolve: vi.fn(),
		} as never);
		expect(response.status).toBe(403);
		expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
		const payload = await expectBlendCalcAPIV1ResponseToMatchOpenAPI({
			path: API_PATH,
			response,
		});
		expect(payload).toMatchObject({ error: { code: "access_denied" } });
		expect(mocks.recordBlendCalcAPISafeRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				actorIdentifier: "blocked-user",
				rateLimitResult: "not-evaluated",
				responseStatus: 403,
			}),
		);
	});

	it("records cache and database observations after a completed API read", async () => {
		const event = createEvent();
		event.request = new Request(event.url, {
			headers: { "if-none-match": '"catalog-hash"' },
		});
		const response = await handle({
			event,
			resolve: vi.fn().mockImplementation(async () => {
				event.locals.blendCalcAPIDatabaseObservation = {
					databaseDurationMs: 12,
					resultCount: 4,
				};
				return new Response(null, { status: 304 });
			}),
		} as never);
		expect(response.status).toBe(304);
		expect(mocks.recordBlendCalcAPIRequestObservation).toHaveBeenCalledWith(
			expect.objectContaining({
				pathname: API_PATH,
				responseStatus: 304,
				cacheValidation: true,
				databaseObservation: {
					databaseDurationMs: 12,
					resultCount: 4,
				},
			}),
		);
	});

	it("replaces a handled server failure with the stable API shape", async () => {
		const response = await handle({
			event: createEvent(),
			resolve: vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ message: "private exception" }), {
					status: 500,
					headers: { "content-type": "application/json" },
				}),
			),
		} as never);
		expect(response.status).toBe(500);
		const payload = await expectBlendCalcAPIV1ResponseToMatchOpenAPI({
			path: API_PATH,
			response,
		});
		expect(payload).toMatchObject({ error: { code: "unexpected_error" } });
		expect(JSON.stringify(payload)).not.toContain("private exception");
	});

	it("contains a thrown API server failure without leaking details", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const response = await handle({
			event: createEvent(),
			resolve: vi.fn().mockRejectedValue(new Error("private thrown exception")),
		} as never);
		expect(response.status).toBe(500);
		const payload = await expectBlendCalcAPIV1ResponseToMatchOpenAPI({
			path: API_PATH,
			response,
		});
		expect(payload).toMatchObject({ error: { code: "unexpected_error" } });
		expect(JSON.stringify(payload)).not.toContain("private thrown exception");
		expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
			"private thrown exception",
		);
		consoleError.mockRestore();
	});

	it("does not replace failures outside blendCalcAPI v1", async () => {
		const requestError = new Error("page failure");
		await expect(
			handle({
				event: createEvent("/profile"),
				resolve: vi.fn().mockRejectedValue(requestError),
			} as never),
		).rejects.toBe(requestError);
		expect(mocks.recordBlendCalcAPISafeRequest).not.toHaveBeenCalled();
	});

	it("logs a normalized successful API request without query or client address", async () => {
		mocks.readVerifiedAuthUser.mockResolvedValue({ id: "private-user-id" });
		const event = createEvent(`${API_PATH}?limit=25&private=value`);
		const response = await handle({
			event,
			resolve: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
		} as never);
		expect(response.status).toBe(200);
		expect(mocks.recordBlendCalcAPISafeRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				actorIdentifier: "private-user-id",
				pathname: API_PATH,
				rateLimitResult: "allowed",
				responseStatus: 200,
			}),
		);
		const recorded = JSON.stringify(
			mocks.recordBlendCalcAPISafeRequest.mock.calls,
		);
		expect(recorded).not.toContain("private=value");
		expect(recorded).not.toContain("127.0.0.1");
	});
});
