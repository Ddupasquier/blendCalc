import { describe, expect, it } from "vitest";
import {
	getCameraErrorMessage,
	getWebCameraSupportMessage,
} from "$lib/utils/barcode/scanner";

describe("barcode scanner browser support", () => {
	it("explains common mobile camera failures", () => {
		expect(getCameraErrorMessage(new DOMException("", "NotAllowedError"))).toMatch(
			/denied/i,
		);
		expect(getCameraErrorMessage(new DOMException("", "NotReadableError"))).toMatch(
			/already in use/i,
		);
		expect(getCameraErrorMessage(new DOMException("", "SecurityError"))).toMatch(
			/blocked camera access/i,
		);
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
				Object.defineProperty(navigator, "mediaDevices", mediaDevicesDescriptor);
			} else {
				Reflect.deleteProperty(navigator, "mediaDevices");
			}
		}
	});
});
