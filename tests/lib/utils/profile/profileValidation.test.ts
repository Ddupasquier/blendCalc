import { describe, expect, it } from "vitest";
import {
	getAvatarExtension,
	getDefaultDisplayName,
	getProfileValidationError,
	matchesAvatarFileSignature,
	normalizeOptionalProfileText,
	PROFILE_BIO_MAX_LENGTH,
	PROFILE_DISPLAY_NAME_MAX_LENGTH,
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
		expect(getProfileValidationError({ displayName: null, bio: null })).toBe(
			"",
		);
	});

	it("accepts a 25-character display name and rejects anything longer", () => {
		expect(PROFILE_DISPLAY_NAME_MAX_LENGTH).toBe(25);
		expect(
			getProfileValidationError({
				displayName: "a".repeat(PROFILE_DISPLAY_NAME_MAX_LENGTH),
				bio: null,
			}),
		).toBe("");
		expect(
			getProfileValidationError({
				displayName: "a".repeat(PROFILE_DISPLAY_NAME_MAX_LENGTH + 1),
				bio: null,
			}),
		).toBe("Display name must be 25 characters or fewer.");
	});

	it("accepts a 150-character bio and rejects anything longer", () => {
		expect(PROFILE_BIO_MAX_LENGTH).toBe(150);
		expect(
			getProfileValidationError({
				displayName: "Dylan",
				bio: "a".repeat(PROFILE_BIO_MAX_LENGTH),
			}),
		).toBe("");
		expect(
			getProfileValidationError({
				displayName: "Dylan",
				bio: "a".repeat(PROFILE_BIO_MAX_LENGTH + 1),
			}),
		).toBe("Bio must be 150 characters or fewer.");
	});

	it("checks image signatures instead of trusting MIME alone", () => {
		expect(
			matchesAvatarFileSignature(
				new Uint8Array([0xff, 0xd8, 0xff]),
				"image/jpeg",
			),
		).toBe(true);
		expect(
			matchesAvatarFileSignature(new Uint8Array([1, 2, 3]), "image/jpeg"),
		).toBe(false);
		expect(getAvatarExtension("image/webp")).toBe("webp");
	});
});
