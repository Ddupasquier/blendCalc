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

const createRequest = (marketingEmailOptIn?: boolean) => {
	const formData = new FormData();
	formData.set("email", "person@example.com");
	formData.set("password", "Strong!Unique-Passphrase26");
	formData.set("passwordConfirmation", "Strong!Unique-Passphrase26");
	if (marketingEmailOptIn !== undefined) {
		formData.set("marketingEmailOptIn", String(marketingEmailOptIn));
	}
	return new Request("http://localhost:5173/auth", {
		method: "POST",
		body: formData,
	});
};

describe("registration marketing email consent", () => {
	it.each([
		[undefined, false],
		[false, false],
		[true, true],
	])(
		"passes the explicit %s choice to account creation as %s",
		async (submittedValue, expectedValue) => {
			const signUp = vi.fn().mockResolvedValue({
				data: { user: { id: "user-1" }, session: null },
				error: null,
			});

			await actions.emailSignUp({
				locals: { supabase: { auth: { signUp } } },
				request: createRequest(submittedValue),
				url: new URL("http://localhost:5173/auth"),
				cookies: createCookies(),
			} as never);

			expect(signUp).toHaveBeenCalledWith(
				expect.objectContaining({
					options: expect.objectContaining({
						data: expect.objectContaining({
							marketing_email_opt_in: expectedValue,
							marketing_email_consent_version: "marketing-consent-2026-09-09",
						}),
					}),
				}),
			);
		},
	);
});
