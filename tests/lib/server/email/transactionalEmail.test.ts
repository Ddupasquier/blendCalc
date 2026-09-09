import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("$lib/server/http/externalRequest.server", () => ({
	fetchWithExternalRequestPolicy: mocks.fetch,
}));

import {
	escapeEmailHtml,
	renderTransactionalEmail,
	sendTransactionalEmail,
} from "$lib/server/email/transactionalEmail.server";

const input = {
	apiKey: "private-provider-key",
	from: "blendCalc <operations@noreply.blendcalc.food>",
	to: ["owner@example.com"],
	subject: "Test message",
	text: "Plain-text fallback",
	html: "<p>HTML message</p>",
	idempotencyKey: "test-message-1",
	replyTo: "support@blendcalc.food",
	tags: [{ name: "category", value: "test_message" }],
};

describe("transactional email", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetch.mockResolvedValue(
			new Response(JSON.stringify({ id: "provider-message-id" }), {
				status: 200,
			}),
		);
	});

	it("sends through the approved domain with retry-safe metadata", async () => {
		await expect(sendTransactionalEmail(input)).resolves.toEqual({
			status: "sent",
			providerMessageId: "provider-message-id",
		});

		const [endpoint, options] = mocks.fetch.mock.calls[0];
		expect(endpoint).toBe("https://api.resend.com/emails");
		expect(options.headers["Idempotency-Key"]).toBe("test-message-1");
		expect(JSON.parse(options.body)).toMatchObject({
			from: input.from,
			to: input.to,
			reply_to: input.replyTo,
			tags: input.tags,
		});
		expect(options.body).not.toContain(input.apiKey);
	});

	it("rejects an unverified sender before contacting the provider", async () => {
		await expect(
			sendTransactionalEmail({ ...input, from: "hello@blendcalc.food" }),
		).resolves.toMatchObject({
			status: "failed",
			errorCode: "email_sender_not_approved",
		});
		expect(mocks.fetch).not.toHaveBeenCalled();
	});

	it("returns safe provider and network failures", async () => {
		mocks.fetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ name: "invalid_request" }), {
				status: 422,
			}),
		);
		await expect(sendTransactionalEmail(input)).resolves.toMatchObject({
			status: "failed",
			errorCode: "invalid_request",
		});

		mocks.fetch.mockRejectedValueOnce(new Error("network unavailable"));
		await expect(sendTransactionalEmail(input)).resolves.toMatchObject({
			status: "failed",
			errorCode: "email_network_error",
		});
	});

	it("renders an escaped, self-contained branded layout", () => {
		const html = renderTransactionalEmail({
			eyebrow: "Security & privacy",
			title: "Hello <owner>",
			bodyHtml: `<p>${escapeEmailHtml("A&B")}</p>`,
		});

		expect(html).toContain("Hello &lt;owner&gt;");
		expect(html).toContain("A&amp;B");
		expect(html).toContain("#57a773");
		expect(html).not.toMatch(/<(?:script|img)\b/i);
	});
});
