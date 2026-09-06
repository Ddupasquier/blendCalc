import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	trackServerAppInteraction: vi.fn(),
}));

vi.mock("$env/dynamic/private", () => ({
	env: {
		BLENDCALC_DATABASE_ENVIRONMENT: "test",
		BLENDCALC_TEST_ACCOUNT_PASSWORD: "generated-local-password",
		BLENDCALC_TEST_ACCOUNTS_BASE64: Buffer.from(
			JSON.stringify([
				{
					key: "user",
					displayName: "QA User",
					email: "qa-user@blendcalc.local",
					role: "user",
					purpose: "Populated everyday state",
				},
				{
					key: "empty",
					displayName: "QA Empty State",
					email: "qa-empty@blendcalc.local",
					role: "user",
					purpose: "Authenticated empty state",
				},
			]),
		).toString("base64"),
	},
}));

vi.mock("$env/dynamic/public", () => ({
	env: {
		PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
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
	return new Request("http://localhost:5174/auth", {
		method: "POST",
		body: formData,
	});
};

describe("local QA sign-in route", () => {
	beforeEach(() => vi.clearAllMocks());

	it("exposes account choices only on the exact local test runtime", async () => {
		const result = (await load({
			locals: { getVerifiedUser: vi.fn().mockResolvedValue(null) },
			request: new Request("http://localhost:5174/auth"),
			url: new URL("http://localhost:5174/auth"),
		} as never)) as {
			localQaSignIn: {
				accounts: Array<{ key: string; email: string }>;
			} | null;
		};

		expect(result.localQaSignIn?.accounts).toContainEqual(
			expect.objectContaining({
				key: "empty",
				email: "qa-empty@blendcalc.local",
			}),
		);
		expect(JSON.stringify(result.localQaSignIn)).not.toContain(
			"generated-local-password",
		);
	});

	it("signs in the selected maintained persona without accepting an email or password", async () => {
		const signInWithPassword = vi.fn().mockResolvedValue({ error: null });

		await expect(
			actions.quickQaSignIn({
				locals: { supabase: { auth: { signInWithPassword } } },
				request: createRequest({
					qaAccount: "empty",
					next: "/ingredients/fridge",
				}),
				url: new URL("http://localhost:5174/auth"),
				cookies: { delete: vi.fn(), set: vi.fn() },
			} as never),
		).rejects.toMatchObject({
			status: 303,
			location: "/ingredients/fridge",
		});

		expect(signInWithPassword).toHaveBeenCalledWith({
			email: "qa-empty@blendcalc.local",
			password: "generated-local-password",
		});
		expect(mocks.trackServerAppInteraction).toHaveBeenCalledOnce();
	});

	it("rejects an account key outside the maintained persona list", async () => {
		const signInWithPassword = vi.fn();
		const result = await actions.quickQaSignIn({
			locals: { supabase: { auth: { signInWithPassword } } },
			request: createRequest({ qaAccount: "attacker-controlled-account" }),
			url: new URL("http://localhost:5174/auth"),
			cookies: {},
		} as never);

		expect(result).toMatchObject({
			status: 400,
			data: {
				message: "Choose a QA account and try again.",
				signInExperience: "quickQa",
			},
		});
		expect(signInWithPassword).not.toHaveBeenCalled();
	});
});
