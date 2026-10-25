import { describe, expect, it, vi } from "vitest";

vi.mock("$app/env/public", async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	const overrides = {
		PUBLIC_SUPABASE_URL: "https://auth.example.supabase.co",
		PUBLIC_TURNSTILE_SITE_KEY: "",
	};
	return new Proxy(actual, {
		get(target, key) {
			return Reflect.has(overrides, key)
				? Reflect.get(overrides, key)
				: Reflect.get(target, key);
		},
	});
});
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
	it.each([
		"https://attacker.example/auth/v1/authorize",
		"https://auth.example.supabase.co.attacker.example/authorize",
		"javascript:alert(1)",
	])(
		"refuses an unexpected authorization destination %s",
		async (destination) => {
			const signInWithOAuth = vi.fn().mockResolvedValue({
				data: { url: destination },
				error: null,
			});
			await expect(
				actions.google({
					locals: { supabase: { auth: { signInWithOAuth } } },
					request: new Request("http://localhost:5174/auth", {
						method: "POST",
						body: new FormData(),
					}),
					url: new URL("http://localhost:5174/auth"),
					cookies: createCookies(),
				} as never),
			).rejects.toBeInstanceOf(Error);
		},
	);

	it.each([5173, 5174, 5175])(
		"asks Google to show its account chooser on port %s",
		async (port) => {
			const signInWithOAuth = vi.fn().mockResolvedValue({
				data: {
					url: "https://auth.example.supabase.co/auth/v1/authorize?provider=google",
				},
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
				location:
					"https://auth.example.supabase.co/auth/v1/authorize?provider=google",
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
