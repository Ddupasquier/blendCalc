import { describe, expect, it, vi } from "vitest";
import { createServerCachedLoader } from "$lib/server/cache/serverCachedLoader";

describe("createServerCachedLoader", () => {
	it("coalesces concurrent loads and reuses the cached value", async () => {
		const load = vi.fn().mockResolvedValue({ value: 1 });
		const getValue = createServerCachedLoader({ load });

		const [first, second] = await Promise.all([getValue(), getValue()]);

		expect(first).toBe(second);
		expect(await getValue()).toBe(first);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("reloads after the configured cache duration", async () => {
		let now = 1_000;
		const load = vi
			.fn()
			.mockResolvedValueOnce("first")
			.mockResolvedValueOnce("second");
		const getValue = createServerCachedLoader({
			load,
			ttlMilliseconds: 100,
			now: () => now,
		});

		expect(await getValue()).toBe("first");
		now = 1_099;
		expect(await getValue()).toBe("first");
		now = 1_100;
		expect(await getValue()).toBe("second");
		expect(load).toHaveBeenCalledTimes(2);
	});

	it("allows a failed load to be retried", async () => {
		const load = vi
			.fn()
			.mockRejectedValueOnce(new Error("temporary failure"))
			.mockResolvedValueOnce("recovered");
		const getValue = createServerCachedLoader({ load });

		await expect(getValue()).rejects.toThrow("temporary failure");
		await expect(getValue()).resolves.toBe("recovered");
		expect(load).toHaveBeenCalledTimes(2);
	});
});
