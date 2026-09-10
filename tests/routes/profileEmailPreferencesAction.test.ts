import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireUser: vi.fn(),
	savePreferences: vi.fn(),
}));

vi.mock("$lib/server/profile/profileActionAuthentication.server", () => ({
	requireAuthenticatedProfileUser: mocks.requireUser,
}));
vi.mock("$lib/server/email/marketingEmailPreferences.server", () => ({
	saveCurrentUserMarketingEmailPreferences: mocks.savePreferences,
}));

import { saveMarketingEmailPreferences } from "$lib/server/profile/profileAccountSettingsActions.server";

const createRequest = (fields: Record<string, string>) => {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) formData.set(key, value);
	return new Request("http://localhost:5173/profile", {
		method: "POST",
		body: formData,
	});
};

const completeValues = {
	product_and_launch_updates: "true",
	mvp_testing_invitations: "false",
	tips_recipes_and_education: "true",
};

describe("Profile marketing email preference action", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.requireUser.mockResolvedValue({ id: "user-1" });
		mocks.savePreferences.mockResolvedValue({ data: [], error: null });
	});

	it("saves the complete explicit preference set through the owner RPC", async () => {
		await expect(
			saveMarketingEmailPreferences({
				locals: { supabase: { name: "authenticated" } },
				request: createRequest(completeValues),
			} as never),
		).resolves.toMatchObject({
			emailPreferencesSuccess: "Email preferences saved.",
			emailPreferenceValues: {
				product_and_launch_updates: true,
				mvp_testing_invitations: false,
				tips_recipes_and_education: true,
			},
		});

		expect(mocks.savePreferences).toHaveBeenCalledWith(
			{ name: "authenticated" },
			{
				product_and_launch_updates: true,
				mvp_testing_invitations: false,
				tips_recipes_and_education: true,
			},
			"marketing-consent-2026-09-09",
		);
	});

	it("rejects a partial or malformed preference submission", async () => {
		const result = await saveMarketingEmailPreferences({
			locals: { supabase: {} },
			request: createRequest({ product_and_launch_updates: "true" }),
		} as never);

		expect(result).toMatchObject({ status: 400 });
		expect(mocks.savePreferences).not.toHaveBeenCalled();
	});
});
