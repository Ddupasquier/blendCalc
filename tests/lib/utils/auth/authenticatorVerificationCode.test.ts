import { describe, expect, it } from "vitest";
import { normalizeAuthenticatorVerificationCode } from "$lib/utils/auth/authenticatorVerificationCode";

describe("authenticator verification codes", () => {
	it.each([
		["123456", "123456"],
		["123 456", "123456"],
		["123-456", "123456"],
		["１２３ ４５６", "123456"],
	])("normalizes %s into the six digits Supabase expects", (input, expected) => {
		expect(normalizeAuthenticatorVerificationCode(input)).toBe(expected);
	});

	it.each(["12345", "1234567", "123ABC", ""])(
		"rejects malformed code %s",
		(input) => {
			expect(normalizeAuthenticatorVerificationCode(input)).toBeNull();
		},
	);
});
