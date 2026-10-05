import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$env/dynamic/private", () => ({
	env: {
		BLENDCALC_RUNTIME_ENVIRONMENT: "rehearsal",
		BLENDCALC_TEST_ACCOUNT_PASSWORD: "synthetic-test-password",
		BLENDCALC_TEST_ACCOUNTS_BASE64: Buffer.from(
			JSON.stringify([
				{
					key: "user",
					displayName: "QA User",
					email: "qa-user@blendcalc.local",
					role: "user",
					purpose: "Synthetic QA control",
				},
			]),
		).toString("base64"),
	},
}));

vi.mock("$env/dynamic/public", () => ({
	env: {
		PUBLIC_SUPABASE_URL: "http://127.0.0.1:58321",
		PUBLIC_TURNSTILE_SITE_KEY: "",
	},
}));

import { actions, load } from "../../src/routes/auth/+page.server";

describe("sandbox ordinary sign-in boundary", () => {
	beforeEach(() => vi.clearAllMocks());

	it("offers ordinary sign-in rather than a generated account picker", async () => {
		const result = (await load({
			locals: { getVerifiedUser: vi.fn().mockResolvedValue(null) },
			request: new Request("http://localhost:5175/auth"),
			url: new URL("http://localhost:5175/auth"),
		} as never)) as { localQaSignIn: unknown };

		expect(result.localQaSignIn).toBeNull();
	});

	it("refuses a submitted QA shortcut even if QA credentials were inherited", async () => {
		const signInWithPassword = vi.fn();
		const body = new FormData();
		body.set("qaAccount", "user");
		const result = await actions.quickQaSignIn({
			locals: { supabase: { auth: { signInWithPassword } } },
			request: new Request("http://localhost:5175/auth", {
				method: "POST",
				body,
			}),
			url: new URL("http://localhost:5175/auth"),
			cookies: {},
		} as never);

		expect(result).toMatchObject({ status: 404 });
		expect(signInWithPassword).not.toHaveBeenCalled();
	});
});
