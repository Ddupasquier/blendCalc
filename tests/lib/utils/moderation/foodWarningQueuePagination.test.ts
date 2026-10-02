import { describe, expect, it } from "vitest";
import {
	encodeFoodWarningQueueCursor,
	readFoodWarningQueueCursor,
} from "$lib/utils/moderation/foodWarningQueuePagination";

describe("food-warning queue cursors", () => {
	const cursor = {
		id: "70000000-0000-4000-8000-000000000001",
		createdAt: "2026-10-02T12:00:00.123456+00:00",
	};
	it("preserves PostgreSQL microseconds and the deterministic ID tie-break", () => {
		expect(
			readFoodWarningQueueCursor(encodeFoodWarningQueueCursor(cursor)),
		).toEqual(cursor);
		expect(readFoodWarningQueueCursor(null)).toBeNull();
	});
	it.each([
		"",
		"not-json",
		"null",
		"[]",
		JSON.stringify({ ...cursor, id: "x),status.eq.resolved" }),
		JSON.stringify({ ...cursor, createdAt: "2026-10-02),id.gt.x" }),
		JSON.stringify({ ...cursor, createdAt: "2026-99-99T00:00:00Z" }),
		JSON.stringify({ ...cursor, createdAt: "2026-02-30T00:00:00Z" }),
		JSON.stringify({ ...cursor, createdAt: "2026-10-02T24:00:00Z" }),
		JSON.stringify({ ...cursor, createdAt: "0000-01-01T00:00:00Z" }),
		JSON.stringify({ ...cursor, extra: true }),
		"x".repeat(181),
	])("rejects malformed and injectable cursor %s", (value) => {
		expect(() => readFoodWarningQueueCursor(value)).toThrow(TypeError);
	});
});
