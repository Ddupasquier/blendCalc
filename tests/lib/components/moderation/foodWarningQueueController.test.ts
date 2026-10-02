import { describe, expect, it, vi } from "vitest";
import { createFoodWarningQueueController } from "$lib/components/moderation/FoodWarningQueues/foodWarningQueueController.svelte";

const page = (ids: string[], nextCursor: string | null, total = 25) => ({
	items: ids.map((id) => ({ id })),
	nextCursor,
	total,
});
describe("food-warning queue request controller", () => {
	it("guards overlapping requests, appends without duplicates, and retains the cursor on a retryable error", async () => {
		let finish!: (value: ReturnType<typeof page>) => void;
		const fetchPage = vi
			.fn()
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finish = resolve;
					}),
			)
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce(page(["c"], null));
		const controller = createFoodWarningQueueController(
			page(["a"], "one"),
			fetchPage,
		);
		const request = controller.loadMore();
		await controller.loadMore();
		expect(fetchPage).toHaveBeenCalledTimes(1);
		expect(controller.state.loading).toBe(true);
		finish(page(["a", "b"], "two"));
		await request;
		expect(controller.state.items.map((item) => item.id)).toEqual(["a", "b"]);
		await controller.loadMore();
		expect(controller.state.items).toHaveLength(2);
		expect(controller.state.nextCursor).toBe("two");
		expect(controller.state.error).toContain("Try again");
		await controller.loadMore();
		expect(fetchPage).toHaveBeenLastCalledWith("two", expect.any(AbortSignal));
		expect(controller.state.items.map((item) => item.id)).toEqual([
			"a",
			"b",
			"c",
		]);
		expect(controller.state.nextCursor).toBeNull();
	});
	it("refreshes the loaded depth after a decision without leaving resolved work or losing later pages", async () => {
		const fetchPage = vi
			.fn()
			.mockResolvedValueOnce(page(["c", "d"], "two"))
			.mockResolvedValueOnce(page(["d", "e"], "new-two", 24));
		const controller = createFoodWarningQueueController(
			page(["a", "b"], "one"),
			fetchPage,
		);
		await controller.loadMore();
		await controller.refresh(page(["b", "c"], "new-one", 24));
		expect(controller.state.items.map((item) => item.id)).toEqual([
			"b",
			"c",
			"d",
			"e",
		]);
		expect(controller.state.total).toBe(24);
		expect(controller.state.nextCursor).toBe("new-two");
	});
	it("retains displayed data after refresh failure and retries the full reconciliation", async () => {
		const fetchPage = vi
			.fn()
			.mockResolvedValueOnce(page(["b"], "two"))
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce(page(["c"], null, 1));
		const controller = createFoodWarningQueueController(
			page(["a"], "one"),
			fetchPage,
		);
		await controller.loadMore();
		await controller.refresh(page(["c"], "next", 1));
		expect(controller.needsRefresh).toBe(true);
		expect(controller.state.items.map((item) => item.id)).toEqual(["a", "b"]);
		await controller.loadMore();
		expect(controller.needsRefresh).toBe(false);
		expect(controller.state.items.map((item) => item.id)).toEqual(["c"]);
	});
	it("ignores an aborted response after a newer server refresh", async () => {
		let finish!: (value: ReturnType<typeof page>) => void;
		const fetchPage = vi.fn().mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		const controller = createFoodWarningQueueController(
			page(["a"], "one"),
			fetchPage,
		);
		const request = controller.loadMore();
		await controller.refresh(page(["new"], null, 1));
		finish(page(["old"], null));
		await request;
		expect(controller.state.items.map((item) => item.id)).toEqual(["new"]);
		expect(controller.state.loading).toBe(false);
	});
	it("reconciles existing pages when another reviewer resolves loaded work between requests", async () => {
		const fetchPage = vi
			.fn()
			.mockResolvedValueOnce(page(["c", "d"], "two", 24))
			.mockResolvedValueOnce(page(["b", "c"], "new-one", 24))
			.mockResolvedValueOnce(page(["d", "e"], "new-two", 24));
		const controller = createFoodWarningQueueController(
			page(["a", "b"], "one"),
			fetchPage,
		);
		await controller.loadMore();
		expect(fetchPage.mock.calls.map(([cursor]) => cursor)).toEqual([
			"one",
			null,
			"new-one",
		]);
		expect(controller.state.items.map((item) => item.id)).toEqual([
			"b",
			"c",
			"d",
			"e",
		]);
		expect(controller.state.total).toBe(24);
		expect(controller.state.loading).toBe(false);
		expect(controller.state.refreshing).toBe(false);
	});
});
