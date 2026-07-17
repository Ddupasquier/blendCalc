import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type {
	BarcodeScanResult,
	BarcodeScannerCallbacks,
	BarcodeScannerStop,
} from "$lib/utils/barcode/types";

type DetectedBarcode = {
	rawValue: string;
	format?: string;
};

type BarcodeDetectorConstructor = new (options?: {
	formats?: string[];
}) => {
	detect: (source: ImageBitmapSource) => Promise<DetectedBarcode[]>;
};

const BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

const createResult = (
	value: string,
	format: string,
	platform: BarcodeScanResult["platform"],
): BarcodeScanResult | null => {
	const canonicalValue = normalizeBarcode(value);
	if (!canonicalValue) return null;

	return {
		value,
		canonicalValue,
		format,
		platform,
	};
};

export const getCameraErrorMessage = (error: unknown) => {
	if (error instanceof DOMException && error.name === "NotAllowedError") {
		return "Camera access was denied. Allow camera access or enter the barcode manually.";
	}
	if (error instanceof DOMException && error.name === "NotFoundError") {
		return "No camera was found on this device.";
	}
	if (error instanceof DOMException && error.name === "NotReadableError") {
		return "The camera is already in use by another app or browser tab. Close it there and try again.";
	}
	if (error instanceof DOMException && error.name === "OverconstrainedError") {
		return "This camera does not support the requested scan mode. Enter the barcode manually.";
	}
	if (error instanceof DOMException && error.name === "SecurityError") {
		return "This browser blocked camera access. Use a secure connection or enter the barcode manually.";
	}
	if (error instanceof DOMException && error.name === "AbortError") {
		return "Camera startup was interrupted. Close other camera views and try again.";
	}
	return "The camera could not start. Enter the barcode manually or try again.";
};

export const getWebCameraSupportMessage = () => {
	if (window.isSecureContext === false) {
		return "Camera scanning requires a secure connection. Enter the barcode manually instead.";
	}
	if (!navigator.mediaDevices?.getUserMedia) {
		return "Camera scanning is not supported by this browser. Enter the barcode manually instead.";
	}
	return null;
};

export const isNativeBarcodePlatform = async () => {
	const { Capacitor } = await import("@capacitor/core");
	return Capacitor.isNativePlatform();
};

export const scanNativeBarcode = async (): Promise<BarcodeScanResult | null> => {
	const {
		CapacitorBarcodeScanner,
		CapacitorBarcodeScannerCameraDirection,
		CapacitorBarcodeScannerTypeHint,
	} = await import("@capacitor/barcode-scanner");
	const scan = await CapacitorBarcodeScanner.scanBarcode({
		hint: CapacitorBarcodeScannerTypeHint.ALL,
		cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
		scanInstructions: "Place the product barcode inside the frame.",
	});

	return createResult(scan.ScanResult, String(scan.format), "capacitor");
};

const startNativeWebScanner = async (
	video: HTMLVideoElement,
	callbacks: BarcodeScannerCallbacks,
): Promise<BarcodeScannerStop | null> => {
	const Detector = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor })
		.BarcodeDetector;
	if (!Detector) return null;

	const stream = await navigator.mediaDevices.getUserMedia({
		video: { facingMode: { ideal: "environment" } },
		audio: false,
	});
	video.srcObject = stream;
	await video.play();

	let detector: InstanceType<BarcodeDetectorConstructor>;
	try {
		detector = new Detector({ formats: BARCODE_FORMATS });
	} catch {
		stream.getTracks().forEach((track) => track.stop());
		video.srcObject = null;
		return null;
	}
	let stopped = false;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const stop = () => {
		stopped = true;
		if (timeoutId) clearTimeout(timeoutId);
		stream.getTracks().forEach((track) => track.stop());
		video.srcObject = null;
	};

	const detect = async () => {
		if (stopped) return;
		try {
			const [barcode] = await detector.detect(video);
			if (barcode) {
				const result = createResult(
					barcode.rawValue,
					barcode.format ?? "unknown",
					"web-native",
				);
				if (result) {
					stop();
					callbacks.onDetected(result);
					return;
				}
			}
		} catch {
			// Individual frames can fail while the camera is moving; keep scanning.
		}
		timeoutId = setTimeout(detect, 160);
	};

	void detect();
	return stop;
};

const startZxingScanner = async (
	video: HTMLVideoElement,
	callbacks: BarcodeScannerCallbacks,
): Promise<BarcodeScannerStop> => {
	const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] =
		await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
	const hints = new Map();
	hints.set(DecodeHintType.POSSIBLE_FORMATS, [
		BarcodeFormat.EAN_13,
		BarcodeFormat.EAN_8,
		BarcodeFormat.UPC_A,
		BarcodeFormat.UPC_E,
	]);
	const reader = new BrowserMultiFormatReader(hints, {
		delayBetweenScanAttempts: 180,
		delayBetweenScanSuccess: 600,
	});
	const controls = await reader.decodeFromConstraints(
		{
			video: { facingMode: { ideal: "environment" } },
			audio: false,
		},
		video,
		(result) => {
			if (!result) return;
			const scanResult = createResult(
				result.getText(),
				String(result.getBarcodeFormat()),
				"web-zxing",
			);
			if (!scanResult) return;
			controls.stop();
			callbacks.onDetected(scanResult);
		},
	);

	return () => controls.stop();
};

export const startWebBarcodeScanner = async (
	video: HTMLVideoElement,
	callbacks: BarcodeScannerCallbacks,
): Promise<BarcodeScannerStop> => {
	const supportMessage = getWebCameraSupportMessage();
	if (supportMessage) {
		callbacks.onError(supportMessage);
		return () => undefined;
	}

	try {
		const nativeStop = await startNativeWebScanner(video, callbacks);
		if (nativeStop) return nativeStop;
		return await startZxingScanner(video, callbacks);
	} catch (error) {
		callbacks.onError(getCameraErrorMessage(error));
		return () => undefined;
	}
};
