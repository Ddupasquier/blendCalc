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
		getRequestRateLimitLayers: vi.fn(),
		isActiveAccountBlock: vi.fn(),
		moderationQuery,
		readVerifiedAuthUser: vi.fn(),
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
		locals: {},
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
		const payload = await expectBlendCalcAPIV1ResponseToMatchOpenAPI({
			path: API_PATH,
			response,
		});
		expect(payload).toMatchObject({ error: { code: "rate_limited" } });
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
		consoleError.mockRestore();
		expect(response.status).toBe(503);
		const payload = await expectBlendCalcAPIV1ResponseToMatchOpenAPI({
			path: API_PATH,
			response,
		});
		expect(payload).toMatchObject({ error: { code: "service_unavailable" } });
		expect(JSON.stringify(payload)).not.toContain(
			"private rate-limit database detail",
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
		consoleError.mockRestore();
		expect(response.status).toBe(500);
		const payload = await expectBlendCalcAPIV1ResponseToMatchOpenAPI({
			path: API_PATH,
			response,
		});
		expect(payload).toMatchObject({ error: { code: "unexpected_error" } });
		expect(JSON.stringify(payload)).not.toContain("private thrown exception");
	});

	it("does not replace failures outside blendCalcAPI v1", async () => {
		const requestError = new Error("page failure");
		await expect(
			handle({
				event: createEvent("/profile"),
				resolve: vi.fn().mockRejectedValue(requestError),
			} as never),
		).rejects.toBe(requestError);
	});
});
