import { describe, expect, it } from "vitest";
import {
	createBarcodeScanResult,
	getCameraErrorMessage,
	getWebCameraSupportMessage,
} from "$lib/utils/barcode/scanner";

describe("barcode scanner browser support", () => {
	it("explains common mobile camera failures", () => {
		expect(
			getCameraErrorMessage(new DOMException("", "NotAllowedError")),
		).toMatch(/denied/i);
		expect(
			getCameraErrorMessage(new DOMException("", "NotReadableError")),
		).toMatch(/already in use/i);
		expect(
			getCameraErrorMessage(new DOMException("", "SecurityError")),
		).toMatch(/blocked camera access/i);
	});

	it("detects browsers without camera capture support", () => {
		const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(
			navigator,
			"mediaDevices",
		);
		Object.defineProperty(navigator, "mediaDevices", {
			configurable: true,
			value: undefined,
		});

		try {
			expect(getWebCameraSupportMessage()).toMatch(/not supported/i);
		} finally {
			if (mediaDevicesDescriptor) {
				Object.defineProperty(
					navigator,
					"mediaDevices",
					mediaDevicesDescriptor,
				);
			} else {
				Reflect.deleteProperty(navigator, "mediaDevices");
			}
		}
	});

	it("turns a GS1 product QR into the same GTIN lookup used by barcodes", () => {
		expect(
			createBarcodeScanResult(
				"https://id.gs1.org/01/09506000151519/10/LOT-22",
				"QR_CODE",
				"web-zxing",
			),
		).toEqual({
			value: "https://id.gs1.org/01/09506000151519/10/LOT-22",
			canonicalValue: "09506000151519",
			format: "QR_CODE",
			platform: "web-zxing",
			captureMethod: "gs1-digital-link",
			sourceReference: "https://id.gs1.org/01/09506000151519",
		});
	});

	it("expands a scanned UPC-E into the provider-compatible canonical GTIN", () => {
		expect(createBarcodeScanResult("03431209", "UPC_E", "web-zxing")).toEqual({
			value: "03431209",
			canonicalValue: "00034000003129",
			format: "UPC_E",
			platform: "web-zxing",
			captureMethod: "linear-scan",
		});
		expect(createBarcodeScanResult("03431209", "15", "capacitor")).toEqual(
			expect.objectContaining({ canonicalValue: "00034000003129" }),
		);
	});
});
