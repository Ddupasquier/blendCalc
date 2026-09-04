export const MAX_SELECTED_IMAGE_PREVIEW_DIMENSION = 512;
export const MAX_SELECTED_IMAGE_PREVIEW_INPUT_BYTES = 20 * 1024 * 1024;

type PreviewWorkerResponse =
	{ ok: true; preview: Blob } | { ok: false; message: string };

type SelectedImageWorkerOptions = {
	maxDimension: number;
	maxBytes?: number;
	quality?: number;
	workerName: string;
};

const abortError = (signal?: AbortSignal) =>
	signal?.reason ??
	new DOMException("Preview preparation cancelled", "AbortError");

const prepareSelectedImage = (
	file: File,
	options: SelectedImageWorkerOptions,
	signal?: AbortSignal,
): Promise<Blob> => {
	if (signal?.aborted) return Promise.reject(abortError(signal));
	if (file.size > MAX_SELECTED_IMAGE_PREVIEW_INPUT_BYTES) {
		return Promise.reject(
			new Error("The selected photo is too large to preview."),
		);
	}
	if (typeof Worker !== "function") {
		return Promise.reject(
			new Error("This browser cannot prepare a nonblocking photo preview."),
		);
	}

	return new Promise<Blob>((resolve, reject) => {
		const sourceUrl = URL.createObjectURL(file);
		let worker: Worker;
		try {
			worker = new Worker(
				new URL("./selectedImagePreview.worker.ts", import.meta.url),
				{
					type: "module",
					name: options.workerName,
				},
			);
		} catch (error) {
			URL.revokeObjectURL(sourceUrl);
			reject(error);
			return;
		}
		let settled = false;
		const finish = (result: { preview: Blob } | { error: unknown }) => {
			if (settled) return;
			settled = true;
			signal?.removeEventListener("abort", handleAbort);
			worker.terminate();
			URL.revokeObjectURL(sourceUrl);
			if ("preview" in result) resolve(result.preview);
			else reject(result.error);
		};
		const handleAbort = () => finish({ error: abortError(signal) });

		worker.onmessage = (event: MessageEvent<PreviewWorkerResponse>) => {
			if (event.data.ok) finish({ preview: event.data.preview });
			else finish({ error: new Error(event.data.message) });
		};
		worker.onerror = () => {
			finish({ error: new Error("The photo preview worker failed.") });
		};
		signal?.addEventListener("abort", handleAbort, { once: true });

		try {
			worker.postMessage({
				sourceUrl,
				maxDimension: options.maxDimension,
				maxBytes: options.maxBytes,
				quality: options.quality,
			});
		} catch (error) {
			finish({ error });
		}
	});
};

export const prepareSelectedImagePreview = (
	file: File,
	signal?: AbortSignal,
): Promise<Blob> =>
	prepareSelectedImage(
		file,
		{
			maxDimension: MAX_SELECTED_IMAGE_PREVIEW_DIMENSION,
			workerName: "selected-image-preview",
		},
		signal,
	);

export const prepareSelectedImageUpload = async (
	file: File,
	{
		maxDimension,
		maxBytes,
		signal,
	}: { maxDimension: number; maxBytes: number; signal?: AbortSignal },
): Promise<File> => {
	if (file.size <= maxBytes) return file;
	const prepared = await prepareSelectedImage(
		file,
		{
			maxDimension,
			maxBytes,
			quality: 0.86,
			workerName: "selected-image-upload",
		},
		signal,
	);
	const baseName = file.name.replace(/\.[^.]+$/, "") || "product-evidence";
	return new File([prepared], `${baseName}.webp`, {
		type: "image/webp",
		lastModified: file.lastModified,
	});
};
