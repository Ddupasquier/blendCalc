import { describe, expect, it, vi } from "vitest";
import { createProgressiveListController } from "$lib/utils/navigation/progressiveListController.svelte";

const page = (ids: string[], cursor: string | null, revision: string) => ({
	items: ids.map((id) => ({ id })),
	total: 3,
	nextCursor: cursor,
	revision,
});

describe("revision-aware progressive lists", () => {
	it("reconciles replacement evidence even when the total is unchanged", async () => {
		const fetchPage = vi
			.fn()
			.mockResolvedValueOnce(page(["c"], "two", "new"))
			.mockResolvedValueOnce(page(["b"], "new-one", "new"))
			.mockResolvedValueOnce(page(["c"], "new-two", "new"));
		const controller = createProgressiveListController(
			page(["a"], "one", "old"),
			fetchPage,
		);
		await controller.loadMore();
		expect(controller.state.items.map(({ id }) => id)).toEqual(["b", "c"]);
		expect(controller.state.page.revision).toBe("new");
		expect(controller.needsRefresh).toBe(false);
	});

	it("retains cards and blocks decisions when evidence changes midway through reconciliation", async () => {
		const fetchPage = vi
			.fn()
			.mockResolvedValueOnce(page(["b"], "two", "old"))
			.mockResolvedValueOnce(page(["d"], null, "changed-again"))
			.mockResolvedValueOnce(page(["c"], "next", "settled"))
			.mockResolvedValueOnce(page(["d"], null, "settled"));
		const controller = createProgressiveListController(
			page(["a"], "one", "old"),
			fetchPage,
		);
		await controller.loadMore();
		await controller.refresh(page(["c"], "next", "new"));
		expect(controller.state.items.map(({ id }) => id)).toEqual(["a", "b"]);
		expect(controller.needsRefresh).toBe(true);
		expect(controller.state.error).toContain(
			"Retry before making another decision",
		);
		await controller.loadMore();
		expect(controller.state.items.map(({ id }) => id)).toEqual(["c", "d"]);
		expect(controller.needsRefresh).toBe(false);
	});
});
