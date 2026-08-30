import { describe, expect, it, vi } from "vitest";
import {
	BlendCalcAPIV1RequestTimeoutError,
	runBlendCalcAPIV1RequestWithinDeadline,
} from "$lib/server/blendCalcAPI/v1/blendCalcAPIRequestBoundary.server";

describe("blendCalcAPI v1 request deadline", () => {
	it("returns completed work and clears its deadline", async () => {
		const result = await runBlendCalcAPIV1RequestWithinDeadline(
			async (databaseAbortSignal) => {
				expect(databaseAbortSignal.aborted).toBe(false);
				return "complete";
			},
			25,
		);

		expect(result).toBe("complete");
	});

	it("aborts database work when the request deadline expires", async () => {
		vi.useFakeTimers();
		let receivedSignal: AbortSignal | undefined;
		const request = runBlendCalcAPIV1RequestWithinDeadline(
			async (databaseAbortSignal) => {
				receivedSignal = databaseAbortSignal;
				return new Promise<never>(() => undefined);
			},
			25,
		);
		const timeoutExpectation = expect(request).rejects.toBeInstanceOf(
			BlendCalcAPIV1RequestTimeoutError,
		);

		await vi.advanceTimersByTimeAsync(25);
		await timeoutExpectation;
		expect(receivedSignal?.aborted).toBe(true);
		vi.useRealTimers();
	});
});
