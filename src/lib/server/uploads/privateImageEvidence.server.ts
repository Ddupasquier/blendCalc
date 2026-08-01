import { createHash } from "node:crypto";
import { normalizeImageUpload } from "$lib/server/uploads/normalizeImageUpload.server";
import {
	isProfileAvatarType,
	matchesAvatarFileSignature,
} from "$lib/utils/profile/profileValidation";

const MAXIMUM_IMAGE_DIMENSION = 4096;

export const PRIVATE_PRODUCT_EVIDENCE_BUCKET = "product-submission-evidence";

export const normalizePrivateImageEvidence = async (
	file: File,
	maximumBytes: number,
) => {
	if (!file.size) throw new Error("Choose a photo to upload.");
	if (file.size > maximumBytes) {
		throw new Error("The photo is larger than the supported upload size.");
	}
	if (!isProfileAvatarType(file.type)) {
		throw new Error("Photos must be JPEG, PNG, or WebP images.");
	}

	const sourceBytes = new Uint8Array(await file.arrayBuffer());
	if (!matchesAvatarFileSignature(sourceBytes, file.type)) {
		throw new Error("The selected photo does not match its file type.");
	}

	const image = await normalizeImageUpload({
		bytes: sourceBytes,
		maximumOutputBytes: maximumBytes,
		maximumWidth: MAXIMUM_IMAGE_DIMENSION,
		maximumHeight: MAXIMUM_IMAGE_DIMENSION,
	});

	return {
		...image,
		sha256: createHash("sha256").update(image.bytes).digest("hex"),
	};
};
