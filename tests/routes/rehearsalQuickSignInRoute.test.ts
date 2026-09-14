import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	trackServerAppInteraction: vi.fn(),
}));

vi.mock("$env/dynamic/private", () => ({
	env: {
		BLENDCALC_RUNTIME_ENVIRONMENT: "rehearsal",
		BLENDCALC_REHEARSAL_ACCOUNT_EMAIL: "rehearsal-developer@blendcalc.local",
		BLENDCALC_REHEARSAL_ACCOUNT_PASSWORD: "local-rehearsal-password",
	},
}));

vi.mock("$env/dynamic/public", () => ({
	env: {
		PUBLIC_SUPABASE_URL: "http://127.0.0.1:58321",
		PUBLIC_TURNSTILE_SITE_KEY: "",
	},
}));

vi.mock("$lib/server/analytics/appInteractionTracking.server", () => ({
	trackServerAppInteraction: mocks.trackServerAppInteraction,
}));

import { actions, load } from "../../src/routes/auth/+page.server";

const createRequest = (fields: Record<string, string>) => {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) formData.set(key, value);
	return new Request("http://localhost:5175/auth", {
		method: "POST",
		body: formData,
	});
};

describe("Rehearsal quick sign-in route", () => {
	beforeEach(() => vi.clearAllMocks());

	it("exposes only the synthetic developer without serializing its password", async () => {
		const result = (await load({
			locals: { getVerifiedUser: vi.fn().mockResolvedValue(null) },
			request: new Request("http://localhost:5175/auth"),
			url: new URL("http://localhost:5175/auth"),
		} as never)) as {
			localQaSignIn: {
				experience: string;
				accounts: Array<{ key: string; email: string }>;
			} | null;
		};

		expect(result.localQaSignIn).toEqual({
			experience: "rehearsal",
			accounts: [
				expect.objectContaining({
					key: "rehearsalDeveloper",
					email: "rehearsal-developer@blendcalc.local",
				}),
			],
		});
		expect(JSON.stringify(result.localQaSignIn)).not.toContain(
			"local-rehearsal-password",
		);
	});

	it("creates a normal local session for the synthetic developer", async () => {
		const signInWithPassword = vi.fn().mockResolvedValue({ error: null });

		await expect(
			actions.quickQaSignIn({
				locals: { supabase: { auth: { signInWithPassword } } },
				request: createRequest({
					qaAccount: "rehearsalDeveloper",
					next: "/ingredients/fridge",
				}),
				url: new URL("http://localhost:5175/auth"),
				cookies: { delete: vi.fn(), set: vi.fn() },
			} as never),
		).rejects.toMatchObject({
			status: 303,
			location: "/ingredients/fridge",
		});

		expect(signInWithPassword).toHaveBeenCalledWith({
			email: "rehearsal-developer@blendcalc.local",
			password: "local-rehearsal-password",
		});
		expect(mocks.trackServerAppInteraction).toHaveBeenCalledOnce();
	});

	it("rejects every account key except the generated synthetic developer", async () => {
		const signInWithPassword = vi.fn();
		const result = await actions.quickQaSignIn({
			locals: { supabase: { auth: { signInWithPassword } } },
			request: createRequest({ qaAccount: "qa-developer" }),
			url: new URL("http://localhost:5175/auth"),
			cookies: {},
		} as never);

		expect(result).toMatchObject({
			status: 400,
			data: {
				message: "Choose the Rehearsal account and try again.",
				signInExperience: "quickQa",
			},
		});
		expect(signInWithPassword).not.toHaveBeenCalled();
	});

	it("does not expose Rehearsal quick sign-in on another port", async () => {
		const result = (await load({
			locals: { getVerifiedUser: vi.fn().mockResolvedValue(null) },
			request: new Request("http://localhost:5174/auth"),
			url: new URL("http://localhost:5174/auth"),
		} as never)) as { localQaSignIn: unknown };

		expect(result.localQaSignIn).toBeNull();
	});
});
