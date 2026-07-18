import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "$lib/server/concurrency/mapWithConcurrency";

describe("mapWithConcurrency", () => {
	it("preserves result order while limiting simultaneous work", async () => {
		let active = 0;
		let peakActive = 0;
		const release: Array<() => void> = [];
		const pending = mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
			active += 1;
			peakActive = Math.max(peakActive, active);
			await new Promise<void>((resolve) => release.push(resolve));
			active -= 1;
			return value * 10;
		});

		await Promise.resolve();
		expect(active).toBe(2);
		release.splice(0).forEach((resolve) => resolve());
		await Promise.resolve();
		await Promise.resolve();
		expect(active).toBe(2);
		release.splice(0).forEach((resolve) => resolve());

		await expect(pending).resolves.toEqual([10, 20, 30, 40]);
		expect(peakActive).toBe(2);
	});
});
