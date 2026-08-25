import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	privateEnvironment: {
		FDA_RECALL_PROXY_SECRET: "",
	},
}));

vi.mock("$env/dynamic/private", () => ({
	env: mocks.privateEnvironment,
}));

import { GET } from "../../src/routes/api/internal/food-safety/fda-recall-source/+server";

const PROXY_SECRET = "test-fda-recall-proxy-secret";

const createEvent = (
	path = "http://localhost/api/internal/food-safety/fda-recall-source",
	secret: string | null = PROXY_SECRET,
) => ({
	request: new Request(path, {
		headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
	}),
	url: new URL(path),
});

describe("FDA recall source proxy route", () => {
	beforeEach(() => {
		mocks.privateEnvironment.FDA_RECALL_PROXY_SECRET = PROXY_SECRET;
	});

	afterEach(() => {
		mocks.privateEnvironment.FDA_RECALL_PROXY_SECRET = "";
		vi.unstubAllGlobals();
	});

	it("rejects requests without the shared server secret", async () => {
		await expect(
			GET(createEvent(undefined, null) as never),
		).rejects.toMatchObject({
			status: 401,
		});
	});

	it("rejects arbitrary upstream paths", async () => {
		for (const sourcePath of [
			"https://example.com/private",
			"/safety/recalls-market-withdrawals-safety-alerts/../../private",
		]) {
			await expect(
				GET(
					createEvent(
						`http://localhost/api/internal/food-safety/fda-recall-source?sourcePath=${encodeURIComponent(sourcePath)}`,
					) as never,
				),
			).rejects.toMatchObject({ status: 400 });
		}
	});

	it("relays only the bounded official FDA recall index", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify([{ path: "/safety/example" }]), {
				status: 200,
				headers: {
					"content-type": "application/json",
					etag: '"recall-index"',
				},
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const response = await GET(createEvent() as never);

		expect(response.status).toBe(200);
		expect(response.headers.get("etag")).toBe('"recall-index"');
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(await response.json()).toEqual([{ path: "/safety/example" }]);
		expect(fetchMock).toHaveBeenCalledWith(
			expect.objectContaining({
				hostname: "www.fda.gov",
				pathname: "/datatables-json/recalls-market-withdrawals.json",
			}),
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
	});

	it("relays only FDA recall detail paths", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response("<p>UPC: 681131328944</p>", {
				status: 200,
				headers: { "content-type": "text/html" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		const sourcePath =
			"/safety/recalls-market-withdrawals-safety-alerts/example-recall";

		const response = await GET(
			createEvent(
				`http://localhost/api/internal/food-safety/fda-recall-source?sourcePath=${encodeURIComponent(sourcePath)}`,
			) as never,
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("681131328944");
		expect(fetchMock).toHaveBeenCalledWith(
			expect.objectContaining({ pathname: sourcePath }),
			expect.any(Object),
		);
	});
});
