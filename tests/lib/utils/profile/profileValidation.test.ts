import { describe, expect, it } from "vitest";
import {
	getAvatarExtension,
	getDefaultDisplayName,
	getProfileValidationError,
	matchesAvatarFileSignature,
	normalizeOptionalProfileText,
} from "$lib/utils/profile/profileValidation";

describe("profile validation", () => {
	it("normalizes empty optional values to null", () => {
		expect(normalizeOptionalProfileText("  ")).toBeNull();
		expect(normalizeOptionalProfileText("  Dylan  ")).toBe("Dylan");
	});

	it("creates a private display fallback from the email prefix", () => {
		expect(getDefaultDisplayName("Dylan.Example+test@example.com")).toBe(
			"Dylan.Example+test",
		);
		expect(getDefaultDisplayName(null)).toBe("Smoothie user");
	});

	it("accepts valid optional profile values", () => {
		expect(
			getProfileValidationError({
				displayName: "Dylan",
				bio: "Kale negotiator.",
			}),
		).toBe("");
	});

	it("requires a preferred name when profile details are saved", () => {
		expect(
			getProfileValidationError({ displayName: null, bio: null }),
		).toContain("preferred name");
	});

	it("checks image signatures instead of trusting MIME alone", () => {
		expect(matchesAvatarFileSignature(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg")).toBe(true);
		expect(matchesAvatarFileSignature(new Uint8Array([1, 2, 3]), "image/jpeg")).toBe(false);
		expect(getAvatarExtension("image/webp")).toBe("webp");
	});
});
