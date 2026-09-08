import { describe, expect, it, vi } from "vitest";

vi.mock("$env/dynamic/public", () => ({ env: {} }));
vi.mock("$lib/server/analytics/appInteractionTracking.server", () => ({
	trackServerAppInteraction: vi.fn(),
}));

import { actions as authActions } from "../../src/routes/auth/+page.server";
import { actions as passwordUpdateActions } from "../../src/routes/auth/update-password/+page.server";

const createRequest = (url: string, fields: Record<string, string>) => {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) formData.set(key, value);
	return new Request(url, { method: "POST", body: formData });
};

const createCookies = () => ({
	get: vi.fn(),
	set: vi.fn(),
	delete: vi.fn(),
});

describe("server password confirmation validation", () => {
	it("rejects mismatched account-creation values before calling Supabase", async () => {
		const signUp = vi.fn();

		const result = await authActions.emailSignUp({
			locals: { supabase: { auth: { signUp } } },
			request: createRequest("http://localhost:5173/auth", {
				email: "person@example.com",
				password: "one sufficiently long passphrase",
				passwordConfirmation: "a different long passphrase",
			}),
			url: new URL("http://localhost:5173/auth"),
			cookies: createCookies(),
		} as never);

		expect(result).toMatchObject({
			status: 400,
			data: { message: "Passwords do not match." },
		});
		expect(signUp).not.toHaveBeenCalled();
	});

	it("rejects mismatched password-update values before calling Supabase", async () => {
		const updateUser = vi.fn();

		const result = await passwordUpdateActions.default({
			locals: {
				getVerifiedUser: vi.fn().mockResolvedValue({
					email: "person@example.com",
					user_metadata: {},
				}),
				supabase: { auth: { updateUser } },
			},
			request: createRequest("http://localhost:5173/auth/update-password", {
				password: "one sufficiently long passphrase",
				passwordConfirmation: "a different long passphrase",
			}),
			cookies: createCookies(),
		} as never);

		expect(result).toMatchObject({
			status: 400,
			data: { message: "Passwords do not match." },
		});
		expect(updateUser).not.toHaveBeenCalled();
	});
});
