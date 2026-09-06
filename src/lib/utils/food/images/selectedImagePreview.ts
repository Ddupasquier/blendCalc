type ImageDimensions = { width: number; height: number };

export type NormalizedImageCrop = {
	left: number;
	top: number;
	right: number;
	bottom: number;
};

type BoundedImageCopyOptions = {
	maxDimension: number;
	maxBytes?: number;
	quality?: number;
	crop?: NormalizedImageCrop;
	preprocessing?: "none" | "grayscale-contrast";
};

const MAX_SELECTED_IMAGE_PREVIEW_INPUT_PIXELS = 40_000_000;

const readUint24LittleEndian = (bytes: Uint8Array, offset: number) =>
	bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);

const readJpegDimensions = (bytes: Uint8Array): ImageDimensions | null => {
	if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const startOfFrameMarkers = new Set([
		0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
		0xcf,
	]);
	let offset = 2;
	while (offset + 8 < bytes.length) {
		while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
		const marker = bytes[offset++];
		if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
		if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
		if (offset + 2 > bytes.length) break;
		const segmentLength = view.getUint16(offset);
		if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
		if (startOfFrameMarkers.has(marker) && segmentLength >= 7) {
			return {
				width: view.getUint16(offset + 5),
				height: view.getUint16(offset + 3),
			};
		}
		offset += segmentLength;
	}
	return null;
};

const readPngDimensions = (bytes: Uint8Array): ImageDimensions | null => {
	if (
		bytes.length < 24 ||
		bytes[0] !== 0x89 ||
		bytes[1] !== 0x50 ||
		bytes[2] !== 0x4e ||
		bytes[3] !== 0x47
	)
		return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20) };
};

const readWebpDimensions = (bytes: Uint8Array): ImageDimensions | null => {
	if (
		bytes.length < 30 ||
		String.fromCharCode(...bytes.subarray(0, 4)) !== "RIFF" ||
		String.fromCharCode(...bytes.subarray(8, 12)) !== "WEBP"
	)
		return null;
	const format = String.fromCharCode(...bytes.subarray(12, 16));
	if (format === "VP8X") {
		return {
			width: readUint24LittleEndian(bytes, 24) + 1,
			height: readUint24LittleEndian(bytes, 27) + 1,
		};
	}
	if (format === "VP8L" && bytes[20] === 0x2f) {
		return {
			width: 1 + (bytes[21]! | ((bytes[22]! & 0x3f) << 8)),
			height:
				1 +
				((bytes[22]! >> 6) | (bytes[23]! << 2) | ((bytes[24]! & 0x0f) << 10)),
		};
	}
	if (
		format === "VP8 " &&
		bytes[23] === 0x9d &&
		bytes[24] === 0x01 &&
		bytes[25] === 0x2a
	) {
		return {
			width: (bytes[26]! | (bytes[27]! << 8)) & 0x3fff,
			height: (bytes[28]! | (bytes[29]! << 8)) & 0x3fff,
		};
	}
	return null;
};

const readDimensions = (bytes: Uint8Array, type: string) => {
	const dimensions =
		type === "image/jpeg"
			? readJpegDimensions(bytes)
			: type === "image/png"
				? readPngDimensions(bytes)
				: type === "image/webp"
					? readWebpDimensions(bytes)
					: null;
	if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
		throw new Error("The selected image dimensions could not be read safely.");
	}
	return dimensions;
};

const drawImageData = (image: ImageData) => {
	const canvas = new OffscreenCanvas(image.width, image.height);
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Image resizing is unavailable.");
	context.putImageData(image, 0, 0);
	return canvas;
};

export const normalizeGrayscaleImageData = (image: ImageData) => {
	let minimum = 255;
	let maximum = 0;
	for (let index = 0; index < image.data.length; index += 4) {
		const luminance = Math.round(
			image.data[index]! * 0.2126 +
				image.data[index + 1]! * 0.7152 +
				image.data[index + 2]! * 0.0722,
		);
		image.data[index] = luminance;
		image.data[index + 1] = luminance;
		image.data[index + 2] = luminance;
		minimum = Math.min(minimum, luminance);
		maximum = Math.max(maximum, luminance);
	}
	const range = maximum - minimum;
	if (range < 24) return image;
	for (let index = 0; index < image.data.length; index += 4) {
		const normalized = Math.round(
			((image.data[index]! - minimum) / range) * 255,
		);
		image.data[index] = normalized;
		image.data[index + 1] = normalized;
		image.data[index + 2] = normalized;
	}
	return image;
};

export const createBoundedSelectedImageCopy = async (
	photo: Blob,
	{
		maxDimension,
		maxBytes,
		quality = 0.82,
		crop,
		preprocessing = "none",
	}: BoundedImageCopyOptions,
): Promise<Blob> => {
	if (typeof OffscreenCanvas !== "function")
		throw new Error("Offscreen image resizing is unavailable.");

	const source = await photo.arrayBuffer();
	const dimensions = readDimensions(new Uint8Array(source), photo.type);
	if (
		dimensions.width * dimensions.height >
		MAX_SELECTED_IMAGE_PREVIEW_INPUT_PIXELS
	)
		throw new Error("The selected image is too large to decode safely.");
	const decodedResult = await (async (): Promise<
		{ bitmap: ImageBitmap; data: null } | { bitmap: null; data: ImageData }
	> => {
		if (typeof createImageBitmap === "function") {
			const resizeOptions =
				!crop && Math.max(dimensions.width, dimensions.height) > maxDimension
					? dimensions.width >= dimensions.height
						? { resizeWidth: maxDimension, resizeQuality: "high" as const }
						: { resizeHeight: maxDimension, resizeQuality: "high" as const }
					: {};
			return {
				bitmap: await createImageBitmap(photo, {
					imageOrientation: "from-image",
					...resizeOptions,
				}),
				data: null,
			};
		}
		if (photo.type === "image/jpeg") {
			const { default: decode } = await import("@jsquash/jpeg/decode.js");
			return {
				bitmap: null,
				data: await decode(source, { preserveOrientation: false }),
			};
		}
		if (photo.type === "image/png") {
			const { default: decode } = await import("@jsquash/png/decode.js");
			return { bitmap: null, data: await decode(source) };
		}
		if (photo.type === "image/webp") {
			const { default: decode } = await import("@jsquash/webp/decode.js");
			return { bitmap: null, data: await decode(source) };
		}
		throw new Error("The selected image type cannot be decoded safely.");
	})();
	const decoded = decodedResult.bitmap ?? decodedResult.data;
	const normalizedCrop = crop
		? {
				left: Math.max(0, Math.min(0.9, crop.left)),
				top: Math.max(0, Math.min(0.9, crop.top)),
				right: Math.max(0.1, Math.min(1, crop.right)),
				bottom: Math.max(0.1, Math.min(1, crop.bottom)),
			}
		: null;
	if (
		normalizedCrop &&
		(normalizedCrop.right - normalizedCrop.left < 0.1 ||
			normalizedCrop.bottom - normalizedCrop.top < 0.1)
	) {
		throw new Error("The selected label crop is too small.");
	}
	const cropWidth = Math.max(
		1,
		Math.round(
			decoded.width *
				(normalizedCrop ? normalizedCrop.right - normalizedCrop.left : 1),
		),
	);
	const cropHeight = Math.max(
		1,
		Math.round(
			decoded.height *
				(normalizedCrop ? normalizedCrop.bottom - normalizedCrop.top : 1),
		),
	);
	let targetDimension = Math.min(maxDimension, Math.max(cropWidth, cropHeight));
	const sourceCanvas: CanvasImageSource =
		decodedResult.bitmap ?? drawImageData(decodedResult.data!);

	try {
		while (true) {
			const scale = Math.min(
				1,
				targetDimension / Math.max(cropWidth, cropHeight),
			);
			const width = Math.max(1, Math.round(cropWidth * scale));
			const height = Math.max(1, Math.round(cropHeight * scale));
			const canvas = new OffscreenCanvas(width, height);
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Image resizing is unavailable.");
			context.drawImage(
				sourceCanvas,
				Math.round(decoded.width * (normalizedCrop?.left ?? 0)),
				Math.round(decoded.height * (normalizedCrop?.top ?? 0)),
				cropWidth,
				cropHeight,
				0,
				0,
				width,
				height,
			);
			if (preprocessing === "grayscale-contrast") {
				const image = context.getImageData(0, 0, canvas.width, canvas.height);
				context.putImageData(normalizeGrayscaleImageData(image), 0, 0);
			}
			for (const candidateQuality of [quality, 0.74, 0.64, 0.54, 0.44]) {
				const copy = await canvas.convertToBlob({
					type: "image/webp",
					quality: Math.min(quality, candidateQuality),
				});
				if (!maxBytes || copy.size <= maxBytes) return copy;
			}
			if (targetDimension <= 640) break;
			targetDimension = Math.max(640, Math.floor(targetDimension * 0.8));
		}

		throw new Error(
			"The selected photo could not be reduced to a safe upload size.",
		);
	} finally {
		decodedResult.bitmap?.close();
	}
};

export const createBoundedSelectedImagePreview = (
	photo: Blob,
	maxDimension: number,
) => createBoundedSelectedImageCopy(photo, { maxDimension });
