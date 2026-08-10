export type ImageEventCallbacks = {
	onLoad?: () => void;
	onError?: () => void;
};

export const observeImageEvents = (
	image: HTMLImageElement,
	callbacks: ImageEventCallbacks,
) => {
	let active = true;
	let settled = false;

	const handleLoad = () => {
		if (settled) return;
		settled = true;
		callbacks.onLoad?.();
	};

	const handleError = () => {
		if (settled) return;
		settled = true;
		callbacks.onError?.();
	};

	image.addEventListener("load", handleLoad);
	image.addEventListener("error", handleError);

	queueMicrotask(() => {
		if (!active || settled || !image.complete) return;
		if (image.naturalWidth > 0) {
			handleLoad();
		} else {
			handleError();
		}
	});

	return () => {
		active = false;
		image.removeEventListener("load", handleLoad);
		image.removeEventListener("error", handleError);
	};
};
