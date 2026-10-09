import { describe, expect, it } from "vitest";
import { readCatalogReviewCursor } from "$lib/utils/moderation/catalogReviewPagination";

describe("catalog review cursor validation", () => {
	const cursor = {
		createdAt: "2026-10-03T12:00:00.123456+00:00",
		id: "99978000-0000-4000-8000-000000000001",
		priority: 0,
	};
	it("preserves PostgreSQL microseconds and the product priority", () => {
		expect(readCatalogReviewCursor(JSON.stringify(cursor))).toEqual(cursor);
		expect(readCatalogReviewCursor(null)).toBeNull();
	});
	it.each([
		{},
		{ ...cursor, priority: 2 },
		{ ...cursor, priority: "0" },
		{ ...cursor, id: "x),bad" },
		{ ...cursor, createdAt: "2026-02-30T12:00:00Z" },
		{ ...cursor, extra: true },
	])("refuses malformed or interpolatable cursors: %j", (value) => {
		expect(() => readCatalogReviewCursor(JSON.stringify(value))).toThrow();
	});
});
