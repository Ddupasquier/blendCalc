import { createBoundedSelectedImageCopy } from "./selectedImagePreview";
import type { NormalizedImageCrop } from "./selectedImagePreview";

type PreviewWorkerRequest = {
	sourceUrl: string;
	maxDimension: number;
	maxBytes?: number;
	quality?: number;
	crop?: NormalizedImageCrop;
	preprocessing?: "none" | "grayscale-contrast";
};

type PreviewWorkerResponse =
	{ ok: true; preview: Blob } | { ok: false; message: string };

const workerScope = self as unknown as {
	onmessage: ((event: MessageEvent<PreviewWorkerRequest>) => void) | null;
	postMessage: (message: PreviewWorkerResponse) => void;
};

workerScope.onmessage = (event) => {
	void fetch(event.data.sourceUrl)
		.then((response) => {
			if (!response.ok)
				throw new Error("The selected photo could not be opened.");
			return response.blob();
		})
		.then((photo) => createBoundedSelectedImageCopy(photo, event.data))
		.then(
			(preview) => workerScope.postMessage({ ok: true, preview }),
			() =>
				workerScope.postMessage({
					ok: false,
					message: "The browser could not prepare this photo preview.",
				}),
		);
};
