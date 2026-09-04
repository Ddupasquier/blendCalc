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
	prepareSelectedImagePreview,
	prepareSelectedImageUpload,
} from "$lib/utils/food/images/selectedImagePreview.client";
import { createBoundedSelectedImagePreview } from "$lib/utils/food/images/selectedImagePreview";

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
		return { putImageData: this.putImageData };
	}
}

describe("selected image preview client", () => {
	const originals = {
		Worker: globalThis.Worker,
		OffscreenCanvas: globalThis.OffscreenCanvas,
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

	it("decodes and resizes with worker-safe codecs before drawing the preview", async () => {
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
		expect(codecs.resize).toHaveBeenCalledWith(
			expect.objectContaining({ width: 4032, height: 3024 }),
			{ width: 512, height: 384 },
		);
		expect(OffscreenCanvasMock.instances[0]).toMatchObject({
			width: 512,
			height: 384,
		});
		expect(OffscreenCanvasMock.instances[0]?.putImageData).toHaveBeenCalledWith(
			expect.objectContaining({ width: 512, height: 384 }),
			0,
			0,
		);
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
