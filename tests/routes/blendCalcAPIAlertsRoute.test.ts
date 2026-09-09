import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	evaluate: vi.fn(),
	readDashboard: vi.fn(),
	sendEmail: vi.fn(),
}));

vi.mock("$env/dynamic/private", () => ({
	env: { CRON_SECRET: "operations-secret" },
}));
vi.mock(
	"$lib/server/blendCalcAPI/operations/blendCalcAPIOperationalAlerts.server",
	() => ({ evaluateBlendCalcAPIOperationalAlerts: mocks.evaluate }),
);
vi.mock(
	"$lib/server/blendCalcAPI/operations/blendCalcAPIOperations.server",
	() => ({ readBlendCalcAPIOperationsDashboard: mocks.readDashboard }),
);
vi.mock("$lib/server/email/blendCalcAPIOperationalAlertEmail.server", () => ({
	sendBlendCalcAPIOperationalAlertEmail: mocks.sendEmail,
}));

import { POST } from "../../src/routes/api/internal/blendCalcAPI/alerts/+server";

const request = (authorized = true) =>
	new Request("http://localhost/api/internal/blendCalcAPI/alerts", {
		method: "POST",
		headers: authorized
			? { authorization: "Bearer operations-secret" }
			: undefined,
	});

describe("blendCalcAPI operational alerts route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.readDashboard.mockResolvedValue({});
		mocks.evaluate.mockReturnValue([]);
		mocks.sendEmail.mockResolvedValue({
			status: "sent",
			providerMessageId: "message-id",
		});
	});

	it("rejects requests without the server-only credential", async () => {
		await expect(
			POST({ request: request(false) } as never),
		).rejects.toMatchObject({ status: 401 });
		expect(mocks.readDashboard).not.toHaveBeenCalled();
	});

	it("keeps a healthy check quiet", async () => {
		const response = await POST({ request: request() } as never);
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		await expect(response.json()).resolves.toMatchObject({
			action: "checked",
			alertCodes: [],
			alertCount: 0,
		});
		expect(mocks.sendEmail).not.toHaveBeenCalled();
	});

	it("sends one combined owner alert", async () => {
		mocks.evaluate.mockReturnValue([
			{
				code: "publication_sync_failed",
				severity: "critical",
				summary: "The latest synchronization failed.",
				title: "Publication synchronization failed",
			},
		]);
		const response = await POST({ request: request() } as never);
		await expect(response.json()).resolves.toMatchObject({
			action: "sent",
			alertCodes: ["publication_sync_failed"],
			alertCount: 1,
		});
		expect(mocks.sendEmail).toHaveBeenCalledOnce();
	});

	it("alerts the owner when an operational data store is unavailable", async () => {
		mocks.readDashboard.mockRejectedValue(new Error("database unavailable"));
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const response = await POST({ request: request() } as never);
		await expect(response.json()).resolves.toMatchObject({
			action: "sent",
			alertCodes: ["operations_dashboard_unavailable"],
			alertCount: 1,
		});
		expect(mocks.sendEmail).toHaveBeenCalledOnce();
		consoleError.mockRestore();
	});

	it("fails the scheduler when owner notification fails", async () => {
		mocks.evaluate.mockReturnValue([
			{
				code: "database_failures",
				severity: "critical",
				summary: "Three database reads failed.",
				title: "Repeated API database failures",
			},
		]);
		mocks.sendEmail.mockResolvedValue({
			status: "failed",
			errorCode: "email_http_500",
			errorMessage: "Provider unavailable",
		});
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		await expect(POST({ request: request() } as never)).rejects.toMatchObject({
			status: 503,
		});
		consoleError.mockRestore();
	});
});
