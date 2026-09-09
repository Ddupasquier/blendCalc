import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("$env/dynamic/private", () => ({
	env: {
		API_ALERT_EMAIL_FROM: "blendCalc <operations@noreply.blendcalc.food>",
		API_ALERT_EMAIL_TO: "owner@example.com,backup@example.com",
		RESEND_API_KEY: "test-key",
	},
}));
vi.mock("$lib/server/http/externalRequest.server", () => ({
	fetchWithExternalRequestPolicy: mocks.fetch,
}));

import { sendBlendCalcAPIOperationalAlertEmail } from "$lib/server/email/blendCalcAPIOperationalAlertEmail.server";

describe("blendCalcAPI operational alert email", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetch.mockResolvedValue(
			new Response(JSON.stringify({ id: "message-id" }), { status: 200 }),
		);
	});

	it("sends one privacy-safe summary to every configured owner", async () => {
		await expect(
			sendBlendCalcAPIOperationalAlertEmail({
				alerts: [
					{
						code: "database_failures",
						severity: "critical",
						summary: "Three database reads failed.",
						title: "Repeated API database failures",
					},
				],
				checkedAt: "2026-09-08T20:05:00.000Z",
			}),
		).resolves.toEqual({ status: "sent", providerMessageId: "message-id" });

		const [, options] = mocks.fetch.mock.calls[0];
		const body = JSON.parse(options.body);
		expect(body.to).toEqual(["owner@example.com", "backup@example.com"]);
		expect(body.tags).toEqual([{ name: "category", value: "api_operations" }]);
		expect(options.headers["Idempotency-Key"]).toMatch(
			/^api-alert-2026090820-[a-f0-9]{24}$/,
		);
		expect(options.body).not.toContain("test-key");
	});

	it("fails closed when the provider rejects delivery", async () => {
		mocks.fetch.mockResolvedValue(
			new Response(JSON.stringify({ name: "invalid_request" }), {
				status: 422,
			}),
		);
		await expect(
			sendBlendCalcAPIOperationalAlertEmail({
				alerts: [
					{
						code: "publication_sync_failed",
						severity: "critical",
						summary: "The latest synchronization failed.",
						title: "Publication synchronization failed",
					},
				],
				checkedAt: "2026-09-08T20:05:00.000Z",
			}),
		).resolves.toMatchObject({
			status: "failed",
			errorCode: "invalid_request",
		});
	});
});
