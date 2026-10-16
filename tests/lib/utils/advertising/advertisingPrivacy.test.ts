import { describe, expect, it, vi } from "vitest";
import {
	ADVERTISING_BLOCK_STORAGE_KEY,
	readAdvertisingBlock,
	writeAdvertisingBlock,
} from "$lib/utils/advertising/advertisingPrivacy";

describe("browser advertising refusal", () => {
	it.each(["", "blocked", "true", "false", "{}", "paid", "consent-granted"])(
		"keeps unrecognized state %s blocked",
		(stored) => expect(readAdvertisingBlock(stored)).toBe(true),
	);
	it("leaves initial consent to the consent manager without granting it", () => {
		expect(readAdvertisingBlock(null)).toBe(false);
	});
	it("permits only a consent request after an explicit choice", () => {
		expect(readAdvertisingBlock("allow-consent-request")).toBe(false);
	});
	it("Global Privacy Control wins over a stored request preference", () => {
		expect(readAdvertisingBlock("allow-consent-request", true)).toBe(true);
	});
	it.each([true, false])("persists only the browser choice %s", (blocked) => {
		const setItem = vi.fn();
		expect(writeAdvertisingBlock({ setItem }, blocked)).toBe(true);
		expect(setItem).toHaveBeenCalledWith(
			ADVERTISING_BLOCK_STORAGE_KEY,
			blocked ? "blocked" : "allow-consent-request",
		);
	});
	it("reports storage failure without claiming the preference was saved", () => {
		expect(
			writeAdvertisingBlock(
				{
					setItem: () => {
						throw new Error("storage unavailable");
					},
				},
				false,
			),
		).toBe(false);
	});
});
