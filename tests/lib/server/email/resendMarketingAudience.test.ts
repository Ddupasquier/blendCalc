import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("$lib/server/http/externalRequest.server", () => ({
	fetchWithExternalRequestPolicy: mocks.fetch,
}));

import { syncResendMarketingContact } from "$lib/server/email/resendMarketingAudience.server";

const topicIds = {
	product_and_launch_updates: "topic-product",
	mvp_testing_invitations: "topic-testing",
	tips_recipes_and_education: "topic-tips",
};

describe("Resend marketing audience projection", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetch.mockResolvedValue(
			new Response(JSON.stringify({ id: "contact-1" }), { status: 200 }),
		);
	});

	it("creates an explicitly subscribed contact with exact topic choices", async () => {
		await expect(
			syncResendMarketingContact({
				apiKey: "private-provider-key",
				email: " Person@Example.com ",
				topicIds,
				preferences: {
					product_and_launch_updates: true,
					mvp_testing_invitations: false,
					tips_recipes_and_education: true,
				},
			}),
		).resolves.toEqual({ status: "synced", contactId: "contact-1" });

		const [endpoint, options] = mocks.fetch.mock.calls[0];
		expect(endpoint).toBe("https://api.resend.com/contacts");
		expect(JSON.parse(options.body)).toEqual({
			email: "person@example.com",
			unsubscribed: false,
			topics: [
				{ id: "topic-product", subscription: "opt_in" },
				{ id: "topic-testing", subscription: "opt_out" },
				{ id: "topic-tips", subscription: "opt_in" },
			],
		});
		expect(options.body).not.toContain("private-provider-key");
	});

	it("updates an existing contact and globally suppresses all-off choices", async () => {
		mocks.fetch
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ name: "contact_already_exists" }), {
					status: 409,
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ id: "contact-1" }), { status: 200 }),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ id: "contact-1" }), { status: 200 }),
			);

		await expect(
			syncResendMarketingContact({
				apiKey: "private-provider-key",
				email: "person@example.com",
				topicIds,
				preferences: {
					product_and_launch_updates: false,
					mvp_testing_invitations: false,
					tips_recipes_and_education: false,
				},
			}),
		).resolves.toEqual({ status: "synced", contactId: "contact-1" });

		expect(mocks.fetch).toHaveBeenCalledTimes(3);
		expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toEqual({
			unsubscribed: true,
		});
		expect(mocks.fetch.mock.calls[2][0]).toBe(
			"https://api.resend.com/contacts/person%40example.com/topics",
		);
	});

	it("fails before provider contact when configuration is incomplete", async () => {
		await expect(
			syncResendMarketingContact({
				apiKey: "private-provider-key",
				email: "invalid",
				topicIds,
				preferences: {
					product_and_launch_updates: false,
					mvp_testing_invitations: false,
					tips_recipes_and_education: false,
				},
			}),
		).resolves.toMatchObject({
			status: "failed",
			errorCode: "marketing_audience_configuration_invalid",
		});
		expect(mocks.fetch).not.toHaveBeenCalled();
	});
});
