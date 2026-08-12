import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	trackServerAppInteraction: vi.fn(),
}));

vi.mock("$env/dynamic/public", () => ({
	env: { PUBLIC_TURNSTILE_SITE_KEY: "test-site-key" },
}));

vi.mock("$lib/server/analytics/appInteractionTracking.server", () => ({
	trackServerAppInteraction: mocks.trackServerAppInteraction,
}));

import { actions, load } from "../../src/routes/auth/+page.server";

const createRequest = (fields: Record<string, string>) => {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) formData.set(key, value);
	return new Request("http://localhost:5173/auth", {
		method: "POST",
		body: formData,
	});
};

describe("Auth Turnstile integration", () => {
	beforeEach(() => vi.clearAllMocks());

	it("provides the configured site key without exposing a provider secret", async () => {
		await expect(load({
			locals: { getVerifiedUser: vi.fn().mockResolvedValue(null) },
			request: new Request("http://localhost:5173/auth"),
			url: new URL("http://localhost:5173/auth"),
		} as never)).resolves.toEqual({
			authError: "",
			turnstileSiteKey: "test-site-key",
			next: "/",
		});
	});

	it("rejects supported email Auth requests before Supabase when the token is missing", async () => {
		const signInWithPassword = vi.fn();

		const result = await actions.emailSignIn({
			locals: { supabase: { auth: { signInWithPassword } } },
			request: createRequest({
				email: "qa-user@blendcalc.local",
				password: "BlendCalc-Local-QA-2026!",
			}),
			url: new URL("http://localhost:5173/auth"),
			cookies: {},
		} as never);

		expect(result).toMatchObject({
			status: 400,
			data: {
				message: "Complete the security check and try again.",
			},
		});
		expect(signInWithPassword).not.toHaveBeenCalled();
	});

	it("passes the one-time token to Supabase email sign-in", async () => {
		const signInWithPassword = vi.fn().mockResolvedValue({
			data: {},
			error: { code: "invalid_credentials" },
		});

		await actions.emailSignIn({
			locals: { supabase: { auth: { signInWithPassword } } },
			request: createRequest({
				email: "qa-user@blendcalc.local",
				password: "BlendCalc-Local-QA-2026!",
				captchaToken: "one-time-turnstile-token",
			}),
			url: new URL("http://localhost:5173/auth"),
			cookies: {},
		} as never);

		expect(signInWithPassword).toHaveBeenCalledWith({
			email: "qa-user@blendcalc.local",
			password: "BlendCalc-Local-QA-2026!",
			options: { captchaToken: "one-time-turnstile-token" },
		});
	});
});
