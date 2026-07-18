import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordProductSourceCacheHit } = vi.hoisted(() => ({
	recordProductSourceCacheHit: vi.fn(),
}));

vi.mock("$lib/server/products/sourceMetrics.server", () => ({
	recordProductSourceCacheHit,
}));

import { coalesceProductApiRequest } from "$lib/server/products/productApiRequests.server";

describe("coalesceProductApiRequest", () => {
	beforeEach(() => {
		recordProductSourceCacheHit.mockClear();
	});

	it("shares one pending provider request across concurrent lookups", async () => {
		let resolveRequest: ((value: string) => void) | undefined;
		const request = vi.fn(() => new Promise<string>((resolve) => {
			resolveRequest = resolve;
		}));

		const first = coalesceProductApiRequest("provider:key", request);
		const second = coalesceProductApiRequest("provider:key", request);
		resolveRequest?.("result");

		await expect(Promise.all([first, second])).resolves.toEqual([
			"result",
			"result",
		]);
		expect(request).toHaveBeenCalledTimes(1);
		expect(recordProductSourceCacheHit).toHaveBeenCalledTimes(1);
	});

	it("removes a finished request so later lookups can refresh", async () => {
		const request = vi.fn().mockResolvedValue("result");

		await coalesceProductApiRequest("provider:key", request);
		await coalesceProductApiRequest("provider:key", request);

		expect(request).toHaveBeenCalledTimes(2);
	});

	it("removes a failed request so a later lookup can retry", async () => {
		const request = vi.fn()
			.mockRejectedValueOnce(new Error("temporary provider error"))
			.mockResolvedValueOnce("recovered");

		await expect(
			coalesceProductApiRequest("provider:retry", request),
		).rejects.toThrow("temporary provider error");
		await expect(
			coalesceProductApiRequest("provider:retry", request),
		).resolves.toBe("recovered");

		expect(request).toHaveBeenCalledTimes(2);
	});
});
