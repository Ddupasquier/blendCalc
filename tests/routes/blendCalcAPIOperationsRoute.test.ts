import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	readDashboard: vi.fn(),
}));

vi.mock("$env/dynamic/private", () => ({
	env: { CRON_SECRET: "operations-secret" },
}));
vi.mock(
	"$lib/server/blendCalcAPI/operations/blendCalcAPIOperations.server",
	() => ({
		readBlendCalcAPIOperationsDashboard: mocks.readDashboard,
	}),
);

import { GET } from "../../src/routes/api/internal/blendCalcAPI/operations/+server";

const request = (authorized = true) =>
	new Request("http://localhost/api/internal/blendCalcAPI/operations", {
		headers: authorized
			? { authorization: "Bearer operations-secret" }
			: undefined,
	});

describe("blendCalcAPI operations dashboard route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.readDashboard.mockResolvedValue({
			currentReadMode: "isolated",
			publication: { counts_match: true, hashes_match: true },
			requests: [],
			shadowParity: [],
			recentPublicationRuns: [],
		});
	});

	it("rejects requests without the server-only credential", async () => {
		await expect(
			GET({ request: request(false) } as never),
		).rejects.toMatchObject({ status: 401 });
		expect(mocks.readDashboard).not.toHaveBeenCalled();
	});

	it("returns the private no-store operational summary", async () => {
		const response = await GET({ request: request() } as never);
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		await expect(response.json()).resolves.toMatchObject({
			currentReadMode: "isolated",
			publication: { counts_match: true, hashes_match: true },
		});
	});

	it("does not leak database errors", async () => {
		mocks.readDashboard.mockRejectedValue(new Error("private database detail"));
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		await expect(GET({ request: request() } as never)).rejects.toMatchObject({
			status: 503,
			body: { message: "Operations dashboard is temporarily unavailable." },
		});
		consoleError.mockRestore();
	});
});
