import { describe, expect, it, vi } from "vitest";
import { createMixDraftPersistenceController } from "$lib/utils/mix/state/mixDraftPersistenceController.svelte";

const createDeferredResult = () => {
	let resolve!: (saved: boolean) => void;
	const promise = new Promise<boolean>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
};

describe("createMixDraftPersistenceController", () => {
	it("serializes saves so an older request cannot overwrite a newer draft", async () => {
		const firstSave = createDeferredResult();
		const secondSave = createDeferredResult();
		const persistDraft = vi
			.fn<(draft: { selectedFoodIds: number[] }) => Promise<boolean>>()
			.mockReturnValueOnce(firstSave.promise)
			.mockReturnValueOnce(secondSave.promise);
		const controller = createMixDraftPersistenceController({ persistDraft });

		const firstRequest = controller.save({ selectedFoodIds: [1] });
		const secondRequest = controller.save({ selectedFoodIds: [1, 2] });

		expect(persistDraft).toHaveBeenCalledTimes(0);
		await Promise.resolve();
		expect(persistDraft).toHaveBeenCalledTimes(1);
		expect(controller.state.busy).toBe(true);

		firstSave.resolve(true);
		await firstRequest;
		await Promise.resolve();
		expect(persistDraft).toHaveBeenNthCalledWith(2, {
			selectedFoodIds: [1, 2],
		});

		secondSave.resolve(true);
		await secondRequest;
		await Promise.resolve();
		expect(controller.state.busy).toBe(false);
		expect(controller.state.error).toBe("");
	});

	it("reports the latest failed save and always clears its busy state", async () => {
		const persistDraft = vi.fn().mockRejectedValue(new Error("offline"));
		const controller = createMixDraftPersistenceController({ persistDraft });

		await expect(controller.save({ selectedFoodIds: [1] })).resolves.toBe(
			false,
		);

		expect(controller.state.busy).toBe(false);
		expect(controller.state.error).toContain("could not be saved");
	});
});
