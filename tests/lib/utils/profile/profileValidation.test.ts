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

	it("creates a private generated display fallback", () => {
		const generatedName = getDefaultDisplayName(
			"414a6998-992f-4f08-9192-012d4e000000",
		);

		expect(generatedName).toMatch(/^User\d{14}$/);
		expect(generatedName).not.toContain("414a");
		expect(getDefaultDisplayName(null)).toMatch(/^User\d{14}$/);
	});

	it("accepts valid optional profile values", () => {
		expect(
			getProfileValidationError({
				displayName: "Dylan",
				bio: "Kale negotiator.",
			}),
		).toBe("");
	});

	it("allows blank preferred names because the app assigns a default", () => {
		expect(
			getProfileValidationError({ displayName: null, bio: null }),
		).toBe("");
	});

	it("checks image signatures instead of trusting MIME alone", () => {
		expect(matchesAvatarFileSignature(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg")).toBe(true);
		expect(matchesAvatarFileSignature(new Uint8Array([1, 2, 3]), "image/jpeg")).toBe(false);
		expect(getAvatarExtension("image/webp")).toBe("webp");
	});
});
