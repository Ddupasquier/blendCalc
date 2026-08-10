export type BarcodeScannerPlatform = "web-native" | "web-zxing" | "capacitor";

export type BarcodeCaptureMethod = "linear-scan" | "gs1-digital-link";

export type BarcodeScanResult = {
	value: string;
	canonicalValue: string;
	format: string;
	platform: BarcodeScannerPlatform;
	captureMethod: BarcodeCaptureMethod;
	sourceReference?: string;
};

export type BarcodeScannerStop = () => void;

export type BarcodeScannerCallbacks = {
	onDetected: (result: BarcodeScanResult) => void;
	onError: (message: string) => void;
};
