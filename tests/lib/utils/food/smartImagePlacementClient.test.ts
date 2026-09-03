import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getImagePlacementGeometry } from "$lib/utils/food/images/imagePlacement";
import {
	MAX_SMART_PLACEMENT_IMAGE_DIMENSION,
	suggestImagePlacement,
} from "$lib/utils/food/images/smartImagePlacement.client";

const tesseract = vi.hoisted(() => ({
	createWorker: vi.fn(),
}));

vi.mock("tesseract.js", () => ({
	createWorker: tesseract.createWorker,
	PSM: { SPARSE_TEXT: "11" },
}));

const geometry = getImagePlacementGeometry({
	naturalWidth: 1200,
	naturalHeight: 800,
	frameWidth: 80,
	frameHeight: 68,
	horizontalMovement: "left-only",
	value: {
		cropX: 50,
		cropY: 50,
		cropZoom: 1,
		fitMode: "contain",
		placementVersion: 2,
	},
});

const createRecognitionResult = () => ({
	data: {
		blocks: [
			{
				paragraphs: [
					{
						lines: [
							{
								text: "Sample Product",
								confidence: 90,
								bbox: { x0: 100, y0: 100, x1: 700, y1: 300 },
							},
						],
					},
				],
			},
		],
	},
});

describe("smart image placement client", () => {
	let recognize: ReturnType<typeof vi.fn>;
	let terminate: ReturnType<typeof vi.fn>;
	let drawImage: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		recognize = vi.fn().mockResolvedValue(createRecognitionResult());
		terminate = vi.fn().mockResolvedValue(undefined);
		drawImage = vi.fn();
		tesseract.createWorker.mockResolvedValue({
			setParameters: vi.fn().mockResolvedValue(undefined),
			recognize,
			terminate,
		});
		vi.stubGlobal(
			"createImageBitmap",
			vi.fn().mockResolvedValue({
				width: 2400,
				height: 1200,
				close: vi.fn(),
			}),
		);
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			drawImage,
		} as unknown as CanvasRenderingContext2D);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("uses one bounded OCR pass without enlarging the selected photo", async () => {
		await suggestImagePlacement({
			image: new Blob(["large-photo"], { type: "image/jpeg" }),
			geometry,
			productName: "Sample Product",
		});

		expect(recognize).toHaveBeenCalledTimes(1);
		const recognitionCanvas = recognize.mock.calls[0]?.[0] as HTMLCanvasElement;
		expect(recognitionCanvas.width).toBe(MAX_SMART_PLACEMENT_IMAGE_DIMENSION);
		expect(recognitionCanvas.height).toBe(600);
		expect(drawImage).toHaveBeenCalledTimes(1);
	});

	it("keeps small selected photos at their original dimensions", async () => {
		vi.mocked(createImageBitmap).mockResolvedValueOnce({
			width: 600,
			height: 300,
			close: vi.fn(),
		} as unknown as ImageBitmap);

		await suggestImagePlacement({
			image: new Blob(["small-photo"], { type: "image/jpeg" }),
			geometry,
			productName: "Sample Product",
		});

		const recognitionCanvas = recognize.mock.calls[0]?.[0] as HTMLCanvasElement;
		expect(recognitionCanvas.width).toBe(600);
		expect(recognitionCanvas.height).toBe(300);
	});

	it("stops the OCR worker when automatic placement exceeds its time limit", async () => {
		recognize.mockReturnValueOnce(new Promise(() => undefined));

		await expect(
			suggestImagePlacement({
				image: new Blob(["slow-photo"], { type: "image/jpeg" }),
				geometry,
				productName: "Sample Product",
				timeoutMilliseconds: 5,
			}),
		).rejects.toMatchObject({ name: "TimeoutError" });
		expect(terminate).toHaveBeenCalledTimes(1);
	});

	it("stops the OCR worker when the user cancels placement", async () => {
		recognize.mockReturnValueOnce(new Promise(() => undefined));
		const abortController = new AbortController();
		const placement = suggestImagePlacement({
			image: new Blob(["cancelled-photo"], { type: "image/jpeg" }),
			geometry,
			productName: "Sample Product",
			signal: abortController.signal,
		});
		await vi.waitFor(() => expect(recognize).toHaveBeenCalledTimes(1));

		abortController.abort();

		await expect(placement).rejects.toMatchObject({ name: "AbortError" });
		expect(terminate).toHaveBeenCalledTimes(1);
	});
});
