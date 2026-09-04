import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const codecs = vi.hoisted(() => ({
	decodeJpeg: vi.fn(),
	resize: vi.fn(),
}));

vi.mock("@jsquash/jpeg/decode.js", () => ({ default: codecs.decodeJpeg }));
vi.mock("@jsquash/resize", () => ({ default: codecs.resize }));

import {
	MAX_SELECTED_IMAGE_PREVIEW_INPUT_BYTES,
	MAX_SELECTED_IMAGE_PREVIEW_DIMENSION,
	MAX_NUTRITION_LABEL_OCR_DIMENSION,
	prepareNutritionLabelOcrImage,
	prepareSelectedImagePreview,
	prepareSelectedImageUpload,
} from "$lib/utils/food/images/selectedImagePreview.client";
import {
	createBoundedSelectedImageCopy,
	createBoundedSelectedImagePreview,
	normalizeGrayscaleImageData,
} from "$lib/utils/food/images/selectedImagePreview";

class PreviewWorkerMock {
	static instances: PreviewWorkerMock[] = [];
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: ErrorEvent) => void) | null = null;
	postMessage = vi.fn();
	terminate = vi.fn();
	constructor(
		readonly url: URL,
		readonly options?: WorkerOptions,
	) {
		PreviewWorkerMock.instances.push(this);
	}
	finish(preview: Blob) {
		this.onmessage?.(
			new MessageEvent("message", { data: { ok: true, preview } }),
		);
	}
}

class OffscreenCanvasMock {
	static instances: OffscreenCanvasMock[] = [];
	putImageData = vi.fn();
	drawImage = vi.fn();
	getImageData = vi.fn().mockReturnValue({
		data: new Uint8ClampedArray([10, 20, 30, 255, 240, 250, 255, 255]),
		width: 2,
		height: 1,
	});
	convertToBlob = vi
		.fn()
		.mockResolvedValue(new Blob(["preview"], { type: "image/webp" }));
	constructor(
		readonly width: number,
		readonly height: number,
	) {
		OffscreenCanvasMock.instances.push(this);
	}
	getContext() {
		return {
			putImageData: this.putImageData,
			drawImage: this.drawImage,
			getImageData: this.getImageData,
		};
	}
}

describe("selected image preview client", () => {
	const originals = {
		Worker: globalThis.Worker,
		OffscreenCanvas: globalThis.OffscreenCanvas,
		createImageBitmap: globalThis.createImageBitmap,
	};
	let createObjectUrlSpy: ReturnType<typeof vi.spyOn>;
	let revokeObjectUrlSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		PreviewWorkerMock.instances = [];
		OffscreenCanvasMock.instances = [];
		const decoded = {
			width: 4032,
			height: 3024,
			data: new Uint8ClampedArray(),
		} as ImageData;
		const resized = {
			width: 512,
			height: 384,
			data: new Uint8ClampedArray(),
		} as ImageData;
		codecs.decodeJpeg.mockReset().mockResolvedValue(decoded);
		codecs.resize.mockReset().mockResolvedValue(resized);
		Object.defineProperty(globalThis, "Worker", {
			configurable: true,
			value: PreviewWorkerMock,
		});
		Object.defineProperty(globalThis, "OffscreenCanvas", {
			configurable: true,
			value: OffscreenCanvasMock,
		});
		createObjectUrlSpy = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValue("blob:selected-photo");
		revokeObjectUrlSpy = vi
			.spyOn(URL, "revokeObjectURL")
			.mockImplementation(() => undefined);
	});

	afterEach(() => {
		createObjectUrlSpy.mockRestore();
		revokeObjectUrlSpy.mockRestore();
		for (const [name, original] of Object.entries(originals)) {
			if (original)
				Object.defineProperty(globalThis, name, {
					configurable: true,
					value: original,
				});
			else Reflect.deleteProperty(globalThis, name);
		}
	});

	it("hands the source URL to a dedicated bounded-preview worker", async () => {
		const promise = prepareSelectedImagePreview(
			new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
		);
		const worker = PreviewWorkerMock.instances[0];
		expect(worker?.options).toMatchObject({
			type: "module",
			name: "selected-image-preview",
		});
		expect(worker?.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceUrl: "blob:selected-photo",
				maxDimension: MAX_SELECTED_IMAGE_PREVIEW_DIMENSION,
			}),
		);
		const preview = new Blob(["preview"], { type: "image/webp" });
		worker?.finish(preview);
		await promise;
		expect(worker?.terminate).toHaveBeenCalledOnce();
		expect(revokeObjectUrlSpy).toHaveBeenCalledWith("blob:selected-photo");
	});

	it("prepares an oversized upload in the worker and preserves useful file metadata", async () => {
		const source = new File([new Uint8Array(12)], "nutrition-label.jpg", {
			type: "image/jpeg",
			lastModified: 42,
		});
		const promise = prepareSelectedImageUpload(source, {
			maxDimension: 4096,
			maxBytes: 8,
		});
		const worker = PreviewWorkerMock.instances[0];
		expect(worker?.options?.name).toBe("selected-image-upload");
		expect(worker?.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({ maxDimension: 4096, maxBytes: 8 }),
		);
		worker?.finish(new Blob([new Uint8Array(6)], { type: "image/webp" }));

		await expect(promise).resolves.toMatchObject({
			name: "nutrition-label.webp",
			type: "image/webp",
			size: 6,
			lastModified: 42,
		});
	});

	it("hands a normalized 1600-pixel label crop to its dedicated worker", async () => {
		const crop = { left: 0.1, top: 0.2, right: 0.9, bottom: 0.8 };
		const promise = prepareNutritionLabelOcrImage(
			new File(["photo"], "label.jpg", { type: "image/jpeg" }),
			crop,
		);
		const worker = PreviewWorkerMock.instances[0];
		expect(worker?.options?.name).toBe("nutrition-label-ocr-image");
		expect(worker?.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				maxDimension: MAX_NUTRITION_LABEL_OCR_DIMENSION,
				crop,
				preprocessing: "grayscale-contrast",
			}),
		);
		worker?.finish(new Blob(["bounded-label"], { type: "image/webp" }));
		await expect(promise).resolves.toMatchObject({ type: "image/webp" });
	});

	it("crops before creating the bounded nutrition working image", async () => {
		const jpeg = new Blob(
			[
				new Uint8Array([
					0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x0b, 0xd0, 0x0f, 0xc0,
					0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff,
					0xd9,
				]),
			],
			{ type: "image/jpeg" },
		);
		await createBoundedSelectedImageCopy(jpeg, {
			maxDimension: MAX_NUTRITION_LABEL_OCR_DIMENSION,
			crop: { left: 0.25, top: 0.25, right: 0.75, bottom: 0.75 },
		});

		const cropCanvas = OffscreenCanvasMock.instances.at(-1);
		expect(cropCanvas).toMatchObject({ width: 1600, height: 1200 });
		expect(cropCanvas?.drawImage).toHaveBeenCalledWith(
			expect.any(OffscreenCanvasMock),
			1008,
			756,
			2016,
			1512,
			0,
			0,
			1600,
			1200,
		);
		expect(codecs.resize).not.toHaveBeenCalled();
	});

	it("normalizes a bounded grayscale copy without changing alpha", () => {
		const image = {
			data: new Uint8ClampedArray([
				10, 20, 30, 90, 120, 130, 140, 180, 240, 250, 255, 255,
			]),
			width: 3,
			height: 1,
		} as ImageData;
		const normalized = normalizeGrayscaleImageData(image);

		expect(normalized.data[0]).toBe(normalized.data[1]);
		expect(normalized.data[1]).toBe(normalized.data[2]);
		expect(normalized.data[0]).toBe(0);
		expect(normalized.data[8]).toBe(255);
		expect([
			normalized.data[3],
			normalized.data[7],
			normalized.data[11],
		]).toEqual([90, 180, 255]);
	});

	it("terminates stale work when the selected photo changes", async () => {
		const controller = new AbortController();
		const promise = prepareSelectedImagePreview(
			new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
			controller.signal,
		);
		controller.abort();
		await expect(promise).rejects.toMatchObject({ name: "AbortError" });
		expect(PreviewWorkerMock.instances[0]?.terminate).toHaveBeenCalledOnce();
	});

	it("does not start decoding an upload beyond the bounded preview limit", async () => {
		const oversizedPhoto = {
			size: MAX_SELECTED_IMAGE_PREVIEW_INPUT_BYTES + 1,
		} as File;

		await expect(prepareSelectedImagePreview(oversizedPhoto)).rejects.toThrow(
			"too large to preview",
		);
		expect(PreviewWorkerMock.instances).toHaveLength(0);
	});

	it("uses the worker-safe codec fallback before drawing the preview", async () => {
		const jpeg = new Blob(
			[
				new Uint8Array([
					0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x0b, 0xd0, 0x0f, 0xc0,
					0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff,
					0xd9,
				]),
			],
			{ type: "image/jpeg" },
		);
		await createBoundedSelectedImagePreview(
			jpeg,
			MAX_SELECTED_IMAGE_PREVIEW_DIMENSION,
		);
		expect(codecs.decodeJpeg).toHaveBeenCalledWith(expect.any(ArrayBuffer), {
			preserveOrientation: false,
		});
		expect(codecs.resize).not.toHaveBeenCalled();
		expect(OffscreenCanvasMock.instances[0]).toMatchObject({
			width: 4032,
			height: 3024,
		});
		expect(OffscreenCanvasMock.instances[1]).toMatchObject({
			width: 512,
			height: 384,
		});
		expect(OffscreenCanvasMock.instances[1]?.drawImage).toHaveBeenCalledWith(
			expect.any(OffscreenCanvasMock),
			0,
			0,
			4032,
			3024,
			0,
			0,
			512,
			384,
		);
	});

	it("prefers native worker image decoding and releases the bitmap", async () => {
		const close = vi.fn();
		const bitmap = { width: 128, height: 128, close } as unknown as ImageBitmap;
		const createBitmap = vi.fn().mockResolvedValue(bitmap);
		Object.defineProperty(globalThis, "createImageBitmap", {
			configurable: true,
			value: createBitmap,
		});
		const jpeg = new Blob(
			[
				new Uint8Array([
					0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x80, 0x00, 0x80,
					0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff,
					0xd9,
				]),
			],
			{ type: "image/jpeg" },
		);

		await createBoundedSelectedImagePreview(
			jpeg,
			MAX_SELECTED_IMAGE_PREVIEW_DIMENSION,
		);

		expect(createBitmap).toHaveBeenCalledWith(jpeg, {
			imageOrientation: "from-image",
		});
		expect(codecs.decodeJpeg).not.toHaveBeenCalled();
		expect(OffscreenCanvasMock.instances[0]?.drawImage).toHaveBeenCalledWith(
			bitmap,
			0,
			0,
			128,
			128,
			0,
			0,
			128,
			128,
		);
		expect(close).toHaveBeenCalledOnce();
	});

	it("rejects unsafe image dimensions before starting a codec", async () => {
		const jpeg = new Blob(
			[
				new Uint8Array([
					0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0xff, 0xff, 0xff, 0xff,
					0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff,
					0xd9,
				]),
			],
			{ type: "image/jpeg" },
		);

		await expect(
			createBoundedSelectedImagePreview(
				jpeg,
				MAX_SELECTED_IMAGE_PREVIEW_DIMENSION,
			),
		).rejects.toThrow("too large to decode safely");
		expect(codecs.decodeJpeg).not.toHaveBeenCalled();
	});
});
