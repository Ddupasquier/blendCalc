import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	claim: vi.fn(),
	track: vi.fn(),
}));

vi.mock("$lib/server/auth/rehearsalOwnerClaim.server", () => ({
	claimRehearsalOwnerAfterGoogleSignIn: mocks.claim,
}));
vi.mock("$lib/server/analytics/appInteractionTracking.server", () => ({
	trackServerAppInteraction: mocks.track,
}));

import { GET } from "../../src/routes/auth/callback/+server";

const cookies = (values: Record<string, string> = {}) => ({
	get: vi.fn((name: string) => values[name]),
	set: vi.fn(),
	delete: vi.fn(),
});

describe("OAuth callback", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.claim.mockResolvedValue(true);
	});

	it("claims and refreshes the Rehearsal owner session before redirecting", async () => {
		const user = {
			id: "22222222-2222-4222-8222-222222222222",
			email: "owner@example.com",
		};
		const exchangeCodeForSession = vi.fn().mockResolvedValue({
			data: { user },
			error: null,
		});
		const refreshSession = vi.fn().mockResolvedValue({ error: null });

		await expect(
			GET({
				locals: {
					supabase: { auth: { exchangeCodeForSession, refreshSession } },
				},
				request: new Request("http://localhost:5175/auth/callback?code=ok"),
				url: new URL("http://localhost:5175/auth/callback?code=ok"),
				cookies: cookies(),
			} as never),
		).rejects.toMatchObject({ status: 303, location: "/" });
		expect(mocks.claim).toHaveBeenCalledWith({
			user,
			requestOrigin: "http://localhost:5175",
		});
		expect(refreshSession).toHaveBeenCalledOnce();
	});

	it("does not refresh a session for an unclaimed local account", async () => {
		mocks.claim.mockResolvedValue(false);
		const refreshSession = vi.fn();
		await expect(
			GET({
				locals: {
					supabase: {
						auth: {
							exchangeCodeForSession: vi.fn().mockResolvedValue({
								data: { user: { id: "other" } },
								error: null,
							}),
							refreshSession,
						},
					},
				},
				request: new Request("http://localhost:5175/auth/callback?code=ok"),
				url: new URL("http://localhost:5175/auth/callback?code=ok"),
				cookies: cookies(),
			} as never),
		).rejects.toMatchObject({ status: 303, location: "/" });
		expect(refreshSession).not.toHaveBeenCalled();
	});
});
