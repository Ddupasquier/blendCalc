import { describe, expect, it, vi } from "vitest";
import { completeServerBackgroundTask } from "$lib/server/runtime/backgroundTask.server";

describe("completeServerBackgroundTask", () => {
	it("hands noncritical work to the deployment runtime when available", async () => {
		let finishTask: (() => void) | undefined;
		const task = new Promise<void>((resolve) => {
			finishTask = resolve;
		});
		const waitUntil = vi.fn();

		await completeServerBackgroundTask(task, waitUntil);

		expect(waitUntil).toHaveBeenCalledWith(task);
		finishTask?.();
		await task;
	});

	it("waits for the work when the runtime has no background hook", async () => {
		const completed = vi.fn();
		const task = Promise.resolve().then(completed);

		await completeServerBackgroundTask(task, null);

		expect(completed).toHaveBeenCalledTimes(1);
	});
});
