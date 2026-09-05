import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tesseract = vi.hoisted(() => ({ createWorker: vi.fn() }));

vi.mock("tesseract.js", () => ({ createWorker: tesseract.createWorker }));

import {
	disposeOcrWorkerCoordinator,
	OCR_WORKER_IDLE_TIMEOUT_MILLISECONDS,
	runCoordinatedOcrRecognition,
} from "$lib/utils/food/ocr/ocrWorkerCoordinator.client";

const result = (text: string) =>
	({ data: { text, confidence: 90 } }) as Awaited<
		ReturnType<typeof runCoordinatedOcrRecognition>
	>;

describe("OCR worker coordinator", () => {
	let recognize: ReturnType<typeof vi.fn>;
	let setParameters: ReturnType<typeof vi.fn>;
	let terminate: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		recognize = vi.fn();
		setParameters = vi.fn().mockResolvedValue(undefined);
		terminate = vi.fn().mockResolvedValue(undefined);
		tesseract.createWorker.mockReset().mockResolvedValue({
			recognize,
			setParameters,
			terminate,
		});
	});

	afterEach(async () => {
		await disposeOcrWorkerCoordinator();
		vi.useRealTimers();
	});

	it("serializes competing recognition jobs on one warm worker", async () => {
		let releaseFirst: ((value: ReturnType<typeof result>) => void) | undefined;
		recognize
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						releaseFirst = resolve;
					}),
			)
			.mockResolvedValueOnce(result("nutrition"));
		const first = runCoordinatedOcrRecognition({
			image: new Blob(["front"]),
			parameters: { tessedit_pageseg_mode: "11" },
			timeoutMilliseconds: 1_000,
		});
		const second = runCoordinatedOcrRecognition({
			image: new Blob(["nutrition"]),
			parameters: { tessedit_pageseg_mode: "3" },
			timeoutMilliseconds: 1_000,
		});

		await vi.waitFor(() => expect(recognize).toHaveBeenCalledTimes(1));
		releaseFirst?.(result("front"));
		await expect(first).resolves.toMatchObject({ data: { text: "front" } });
		await expect(second).resolves.toMatchObject({
			data: { text: "nutrition" },
		});
		expect(tesseract.createWorker).toHaveBeenCalledTimes(1);
		expect(setParameters).toHaveBeenNthCalledWith(1, {
			tessedit_pageseg_mode: "11",
		});
		expect(setParameters).toHaveBeenNthCalledWith(2, {
			tessedit_pageseg_mode: "3",
		});
	});

	it("terminates the active worker after cancellation", async () => {
		recognize.mockReturnValue(new Promise(() => undefined));
		const controller = new AbortController();
		const recognition = runCoordinatedOcrRecognition({
			image: new Blob(["label"]),
			parameters: { tessedit_pageseg_mode: "3" },
			signal: controller.signal,
			timeoutMilliseconds: 1_000,
		});
		await vi.waitFor(() => expect(recognize).toHaveBeenCalledOnce());
		controller.abort();

		await expect(recognition).rejects.toMatchObject({ name: "AbortError" });
		expect(terminate).toHaveBeenCalledOnce();
	});

	it("terminates stalled recognition at its deadline", async () => {
		recognize.mockReturnValue(new Promise(() => undefined));
		const recognition = runCoordinatedOcrRecognition({
			image: new Blob(["label"]),
			parameters: { tessedit_pageseg_mode: "11" },
			timeoutMilliseconds: 5,
		});

		await expect(recognition).rejects.toMatchObject({ name: "TimeoutError" });
		expect(terminate).toHaveBeenCalledOnce();
	});

	it("releases a warm worker after the short reuse window", async () => {
		vi.useFakeTimers();
		recognize.mockResolvedValue(result("label"));
		await runCoordinatedOcrRecognition({
			image: new Blob(["label"]),
			parameters: { tessedit_pageseg_mode: "11" },
			timeoutMilliseconds: 1_000,
		});
		expect(terminate).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(OCR_WORKER_IDLE_TIMEOUT_MILLISECONDS);
		expect(terminate).toHaveBeenCalledOnce();
	});
});
