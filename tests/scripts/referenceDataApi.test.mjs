import { afterEach, describe, expect, it, vi } from "vitest";
import {
	fetchWithRetry,
	runSettledWithConcurrency,
} from "../../scripts/lib/reference-data/api.mjs";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("reference-data API helpers", () => {
	it("does not retry permanent HTTP failures", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(null, { status: 404 }),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			fetchWithRetry("https://example.test/missing", {}, {
				attempts: 4,
				baseDelayMilliseconds: 0,
			}),
		).rejects.toThrow("returned 404");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("retries temporary failures and returns a later success", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 503 }))
			.mockResolvedValueOnce(new Response("ok", { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		const response = await fetchWithRetry("https://example.test/temporary", {}, {
			attempts: 2,
			baseDelayMilliseconds: 0,
		});

		expect(await response.text()).toBe("ok");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("keeps successful work when another bounded task fails", async () => {
		const result = await runSettledWithConcurrency(
			["first", "broken", "last"],
			2,
			async (item) => {
				if (item === "broken") throw new Error("temporary provider outage");
				return item.toUpperCase();
			},
		);

		expect(result.values).toEqual(["FIRST", "LAST"]);
		expect(result.failures).toHaveLength(1);
		expect(result.failures[0].item).toBe("broken");
		expect(result.failures[0].error.message).toBe("temporary provider outage");
	});
});
