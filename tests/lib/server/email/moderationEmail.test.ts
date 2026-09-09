import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("$env/dynamic/private", () => ({
	env: {
		MODERATION_EMAIL_FROM: "blendCalc <moderation@noreply.blendcalc.food>",
		MODERATION_SUPPORT_EMAIL: "support@blendcalc.food",
		RESEND_API_KEY: "test-key",
	},
}));
vi.mock("$lib/server/http/externalRequest.server", () => ({
	fetchWithExternalRequestPolicy: mocks.fetch,
}));

import {
	getModerationEmailConfigurationError,
	sendAccountBlockedEmail,
} from "$lib/server/email/moderationEmail.server";

describe("moderation email", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetch.mockResolvedValue(
			new Response(JSON.stringify({ id: "message-id" }), { status: 200 }),
		);
	});

	it("uses the moderation sender, support reply address, and shared layout", async () => {
		expect(getModerationEmailConfigurationError()).toBeNull();
		await expect(
			sendAccountBlockedEmail({
				email: "member@example.com",
				displayName: "Person <script>",
				moderationActionId: "action-id",
				reason: "fraud_or_spam",
			}),
		).resolves.toEqual({ status: "sent", providerMessageId: "message-id" });

		const [, options] = mocks.fetch.mock.calls[0];
		const body = JSON.parse(options.body);
		expect(body).toMatchObject({
			from: "blendCalc <moderation@noreply.blendcalc.food>",
			to: ["member@example.com"],
			reply_to: "support@blendcalc.food",
			tags: [{ name: "category", value: "account_blocked" }],
		});
		expect(body.text).toContain("Reason: Fraud or spam");
		expect(body.html).toContain("Person &lt;script&gt;");
		expect(body.html).not.toContain("Person <script>");
		expect(options.headers["Idempotency-Key"]).toBe("moderation-ban-action-id");
	});

	it("returns the provider failure without exposing credentials", async () => {
		mocks.fetch.mockResolvedValue(
			new Response(
				JSON.stringify({ name: "rate_limited", message: "Try again later." }),
				{ status: 429 },
			),
		);

		const result = await sendAccountBlockedEmail({
			email: "member@example.com",
			displayName: "Member",
			moderationActionId: "action-id",
			reason: "terms_violation",
		});

		expect(result).toEqual({
			status: "failed",
			errorCode: "rate_limited",
			errorMessage: "Try again later.",
		});
		expect(JSON.stringify(result)).not.toContain("test-key");
	});
});
