import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	track: vi.fn(),
	env: { BLENDCALC_RUNTIME_ENVIRONMENT: "rehearsal" },
}));

vi.mock("$env/dynamic/public", () => ({
	env: { PUBLIC_SITE_URL: "https://www.blendcalc.food" },
}));
vi.mock("$env/dynamic/private", () => ({ env: mocks.env }));
vi.mock("$lib/server/analytics/appInteractionTracking.server", () => ({
	trackServerAppInteraction: mocks.track,
}));

import { GET } from "../../src/routes/auth/callback/+server";
import { APP_INTERACTION_METRICS } from "../../src/lib/utils/analytics/appInteractionMetrics";

const createEvent = (
	address = "http://localhost:5175/auth/callback?code=ok",
	values: Record<string, string> = {},
) => {
	const exchangeCodeForSession = vi.fn().mockResolvedValue({
		data: {
			user: {
				id: "22222222-2222-4222-8222-222222222222",
				email: "owner@example.com",
				app_metadata: { provider: "google" },
			},
		},
		error: null,
	});
	const refreshSession = vi
		.fn()
		.mockRejectedValue(new Error("Unexpected refresh"));
	const rpc = vi
		.fn()
		.mockRejectedValue(new Error("Unexpected identity transfer"));
	return {
		locals: {
			supabase: { auth: { exchangeCodeForSession, refreshSession }, rpc },
		},
		request: new Request(address),
		url: new URL(address),
		cookies: {
			get: vi.fn((name: string) => values[name]),
			set: vi.fn(),
			delete: vi.fn(),
		},
	};
};

describe("OAuth callback", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.env.BLENDCALC_RUNTIME_ENVIRONMENT = "rehearsal";
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	it.each([
		["local", "http://localhost:5173"],
		["test", "http://localhost:5174"],
		["rehearsal", "http://localhost:5175"],
		["production", "https://www.blendcalc.food"],
	])(
		"completes %s login at %s without consumer-owned identity transfer",
		async (runtime, origin) => {
			mocks.env.BLENDCALC_RUNTIME_ENVIRONMENT = runtime;
			const event = createEvent(
				`${origin}/auth/callback?code=ok&next=/profile`,
			);
			await expect(GET(event as never)).rejects.toMatchObject({
				status: 303,
				location: "/profile",
			});
			expect(
				event.locals.supabase.auth.exchangeCodeForSession,
			).toHaveBeenCalledExactlyOnceWith("ok");
			expect(event.locals.supabase.auth.refreshSession).not.toHaveBeenCalled();
			expect(event.locals.supabase.rpc).not.toHaveBeenCalled();
			expect(mocks.track).toHaveBeenCalledExactlyOnceWith(
				APP_INTERACTION_METRICS.LOGIN_SUCCESS,
				event.request,
			);
		},
	);

	it("uses and consumes the originating flow's next path instead of query overrides", async () => {
		const event = createEvent(
			"http://localhost:5175/auth/callback?code=ok&next=/profile",
			{
				"blendcalc-auth-next": "/ingredients/fridge",
				"blendcalc-auth-origin": "http://localhost:5175",
				"blendcalc-auth-flow-id": "flow-1",
			},
		);
		await expect(GET(event as never)).rejects.toMatchObject({
			status: 303,
			location: "/ingredients/fridge",
		});
		for (const name of [
			"blendcalc-auth-next",
			"blendcalc-auth-origin",
			"blendcalc-auth-flow-id",
		]) {
			expect(event.cookies.delete).toHaveBeenCalledWith(name, { path: "/" });
		}
	});

	it.each(["https://example.com/private", "//example.com/private"])(
		"rejects the external destination %s",
		async (next) => {
			const event = createEvent(
				`http://localhost:5175/auth/callback?code=ok&next=${encodeURIComponent(next)}`,
			);
			await expect(GET(event as never)).rejects.toMatchObject({
				status: 303,
				location: "/",
			});
		},
	);

	it("refuses a callback on the wrong origin before exchanging its code", async () => {
		const event = createEvent(undefined, {
			"blendcalc-auth-next": "/profile",
			"blendcalc-auth-origin": "http://localhost:5173",
			"blendcalc-auth-flow-id": "flow-1",
		});
		await expect(GET(event as never)).rejects.toMatchObject({
			status: 303,
			location: "/auth?error=wrong_origin&next=%2Fprofile",
		});
		expect(
			event.locals.supabase.auth.exchangeCodeForSession,
		).not.toHaveBeenCalled();
		expect(mocks.track).not.toHaveBeenCalled();
	});

	it("preserves the ordinary code-exchange failure redirect", async () => {
		const event = createEvent();
		event.locals.supabase.auth.exchangeCodeForSession.mockResolvedValue({
			data: { user: null },
			error: { message: "Expired code", status: 400, code: "bad_code" },
		});
		await expect(GET(event as never)).rejects.toMatchObject({
			status: 303,
			location: "/auth?error=callback_exchange&next=%2F",
		});
		expect(mocks.track).not.toHaveBeenCalled();
		expect(event.locals.supabase.auth.refreshSession).not.toHaveBeenCalled();
	});

	it.each([
		["", "missing_code"],
		["?error_description=Access%20denied", "provider"],
	])(
		"preserves the missing-code/provider failure for %s",
		async (query, reason) => {
			const event = createEvent(`http://localhost:5175/auth/callback${query}`);
			await expect(GET(event as never)).rejects.toMatchObject({
				status: 303,
				location: `/auth?error=${reason}&next=%2F`,
			});
			expect(
				event.locals.supabase.auth.exchangeCodeForSession,
			).not.toHaveBeenCalled();
			expect(mocks.track).not.toHaveBeenCalled();
		},
	);
});
