import { describe, expect, it, vi } from "vitest";
import { retireLocalQaCatalogFixtureHealth } from "../e2e/support/localQaCatalogFixtureRetirement.ts";

describe("purpose-owned catalog fixture retirement", () => {
	for (const scope of [
		undefined,
		"",
		"99978",
		"50000\n",
		"50000';delete",
		"80000",
	]) {
		it(`refuses unsafe namespace ${JSON.stringify(scope)} before execution`, () => {
			const execute = vi.fn();
			expect(() => retireLocalQaCatalogFixtureHealth(scope, execute)).toThrow(
				"Invalid purpose-owned",
			);
			expect(execute).not.toHaveBeenCalled();
		});
	}
	for (const [first, last] of [
		[0, 16],
		[1, 17],
		[49, 62],
		[17, 16],
		[1.5, 16],
	]) {
		it(`refuses unbounded batch ${first}..${last} before execution`, () => {
			const execute = vi.fn();
			expect(() =>
				retireLocalQaCatalogFixtureHealth("50000", execute, first, last),
			).toThrow("Invalid bounded");
			expect(execute).not.toHaveBeenCalled();
		});
	}
	it("accepts an owned namespace only with no remaining actionable work", () => {
		const execute = vi.fn(() => Buffer.from("0"));
		expect(() =>
			retireLocalQaCatalogFixtureHealth("50000", execute),
		).not.toThrow();
	});
	for (const remaining of ["2", "unreadable", ""]) {
		it(`refuses unsuccessful retirement result ${remaining}`, () => {
			const execute = vi
				.fn()
				.mockReturnValueOnce(Buffer.from(""))
				.mockReturnValueOnce(Buffer.from(remaining));
			expect(() => retireLocalQaCatalogFixtureHealth("50000", execute)).toThrow(
				"left actionable publication work",
			);
		});
	}
});
