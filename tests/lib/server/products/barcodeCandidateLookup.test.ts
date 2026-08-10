import { describe, expect, it, vi } from "vitest";
import { findFirstBarcodeCandidateMatch } from "$lib/server/products/barcodeCandidateLookup";

describe("findFirstBarcodeCandidateMatch", () => {
	it("stops requesting equivalent codes after the first match", async () => {
		const lookupCandidate = vi.fn(async (candidate: string) => (
			candidate === "021130493609" ? { id: 2032704 } : null
		));

		await expect(
			findFirstBarcodeCandidateMatch("00021130493609", lookupCandidate),
		).resolves.toEqual({
			candidate: "021130493609",
			value: { id: 2032704 },
		});
		expect(lookupCandidate).toHaveBeenCalledTimes(1);
	});

	it("tries later equivalents only when earlier forms do not match", async () => {
		const lookupCandidate = vi.fn(async (candidate: string) => (
			candidate.length === 13 ? "matched" : null
		));

		await expect(
			findFirstBarcodeCandidateMatch("00021130493609", lookupCandidate),
		).resolves.toEqual({
			candidate: "0021130493609",
			value: "matched",
		});
		expect(lookupCandidate.mock.calls.map(([candidate]) => candidate)).toEqual([
			"021130493609",
			"0021130493609",
		]);
	});

	it("stops immediately when a provider request fails", async () => {
		const lookupCandidate = vi.fn(async () => {
			throw new Error("rate limited");
		});

		await expect(
			findFirstBarcodeCandidateMatch("00021130493609", lookupCandidate),
		).rejects.toThrow("rate limited");
		expect(lookupCandidate).toHaveBeenCalledTimes(1);
	});
});
