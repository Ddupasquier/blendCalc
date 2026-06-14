import { describe, expect, it } from "vitest";
import {
	CLOUD_CURSOR_PAGE_SIZE,
	readAllCursorPages,
} from "$lib/utils/storage/supabase/shared";

describe("Supabase cursor pagination", () => {
	it("reads successive pages without dropping rows", async () => {
		const firstPage = Array.from(
			{ length: CLOUD_CURSOR_PAGE_SIZE },
			(_, index) => ({ id: `${index}`.padStart(4, "0") }),
		);
		const secondPage = [{ id: "0500" }, { id: "0501" }];
		const seenCursors: Array<string | null> = [];

		const rows = await readAllCursorPages(async (cursorId) => {
			seenCursors.push(cursorId);
			return {
				data: cursorId ? secondPage : firstPage,
				error: null,
			};
		});

		expect(rows).toHaveLength(CLOUD_CURSOR_PAGE_SIZE + secondPage.length);
		expect(seenCursors).toEqual([null, "0499"]);
	});

	it("returns null when a page fails", async () => {
		await expect(
			readAllCursorPages(async () => ({ data: null, error: new Error("failed") })),
		).resolves.toBeNull();
	});
});
