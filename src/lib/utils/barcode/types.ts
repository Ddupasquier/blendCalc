export type BarcodeScannerPlatform = "web-native" | "web-zxing" | "capacitor";

export type BarcodeScanResult = {
	value: string;
	canonicalValue: string;
	format: string;
	platform: BarcodeScannerPlatform;
};

export type BarcodeScannerStop = () => void;

export type BarcodeScannerCallbacks = {
	onDetected: (result: BarcodeScanResult) => void;
	onError: (message: string) => void;
};
