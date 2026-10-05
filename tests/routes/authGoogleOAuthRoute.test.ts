import { describe, expect, it, vi } from "vitest";

vi.mock("$env/dynamic/public", () => ({ env: {} }));
vi.mock("$lib/server/analytics/appInteractionTracking.server", () => ({
	trackServerAppInteraction: vi.fn(),
}));

import { actions } from "../../src/routes/auth/+page.server";

const createCookies = () => ({
	get: vi.fn(),
	set: vi.fn(),
	delete: vi.fn(),
});

describe("Google OAuth route", () => {
	it.each([5173, 5174, 5175])(
		"asks Google to show its account chooser on port %s",
		async (port) => {
			const signInWithOAuth = vi.fn().mockResolvedValue({
				data: { url: "https://accounts.google.com/o/oauth2/v2/auth" },
				error: null,
			});
			const formData = new FormData();
			formData.set("next", "/ingredients/fridge");

			await expect(
				actions.google({
					locals: { supabase: { auth: { signInWithOAuth } } },
					request: new Request(`http://localhost:${port}/auth`, {
						method: "POST",
						body: formData,
					}),
					url: new URL(`http://localhost:${port}/auth`),
					cookies: createCookies(),
				} as never),
			).rejects.toMatchObject({
				status: 303,
				location: "https://accounts.google.com/o/oauth2/v2/auth",
			});

			expect(signInWithOAuth).toHaveBeenCalledWith({
				provider: "google",
				options: {
					redirectTo: `http://localhost:${port}/auth/callback`,
					queryParams: {
						prompt: "select_account",
					},
				},
			});
		},
	);
});
