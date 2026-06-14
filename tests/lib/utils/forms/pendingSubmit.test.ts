import { describe, expect, it, vi } from "vitest";
import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";

describe("createPendingSubmit", () => {
	it("cancels a second submission while the first is pending", async () => {
		const pendingStates: boolean[] = [];
		const submit = createPendingSubmit((pending) => pendingStates.push(pending));
		const cancelFirst = vi.fn();
		const cancelSecond = vi.fn();

		const finishFirst = await submit({ cancel: cancelFirst } as never);
		await submit({ cancel: cancelSecond } as never);

		expect(cancelFirst).not.toHaveBeenCalled();
		expect(cancelSecond).toHaveBeenCalledOnce();
		expect(pendingStates).toEqual([true]);

		if (finishFirst) {
			await finishFirst({ update: vi.fn().mockResolvedValue(undefined) } as never);
		}
		expect(pendingStates).toEqual([true, false]);
	});

	it("clears pending state when an enhanced update fails", async () => {
		const pendingStates: boolean[] = [];
		const submit = createPendingSubmit((pending) => pendingStates.push(pending));
		const finish = await submit({ cancel: vi.fn() } as never);

		if (!finish) throw new Error("Expected an enhanced submit callback.");
		await expect(
			finish({ update: vi.fn().mockRejectedValue(new Error("failed")) } as never),
		).rejects.toThrow("failed");
		expect(pendingStates).toEqual([true, false]);
	});
});
