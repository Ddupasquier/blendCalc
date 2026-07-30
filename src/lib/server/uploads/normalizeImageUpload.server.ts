import sharp from "sharp";

const UPLOAD_IMAGE_MAX_INPUT_PIXELS = 40_000_000;

export type NormalizedImageUpload = {
	bytes: Uint8Array;
	contentType: "image/webp";
	extension: "webp";
	width: number;
	height: number;
};

export const normalizeImageUpload = async ({
	bytes,
	maximumOutputBytes,
	maximumWidth,
	maximumHeight,
}: {
	bytes: Uint8Array;
	maximumOutputBytes: number;
	maximumWidth: number;
	maximumHeight: number;
}): Promise<NormalizedImageUpload> => {
	if (bytes.byteLength === 0) throw new Error("The image is empty.");

	const image = sharp(bytes, {
		animated: false,
		failOn: "warning",
		limitInputPixels: UPLOAD_IMAGE_MAX_INPUT_PIXELS,
		sequentialRead: true,
	});
	const metadata = await image.metadata();
	if (
		!metadata.width ||
		!metadata.height ||
		(metadata.pages ?? 1) !== 1 ||
		metadata.width * metadata.height > UPLOAD_IMAGE_MAX_INPUT_PIXELS
	) {
		throw new Error("The image dimensions are unsupported.");
	}

	const normalized = await image
		.rotate()
		.resize({
			width: maximumWidth,
			height: maximumHeight,
			fit: "inside",
			withoutEnlargement: true,
		})
		.webp({
			quality: 92,
			effort: 4,
			smartSubsample: true,
		})
		.toBuffer({ resolveWithObject: true });
	if (normalized.data.byteLength > maximumOutputBytes) {
		throw new Error("The normalized image is too large.");
	}

	return {
		bytes: new Uint8Array(normalized.data),
		contentType: "image/webp",
		extension: "webp",
		width: normalized.info.width,
		height: normalized.info.height,
	};
};
