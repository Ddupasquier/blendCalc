import { describe, expect, it } from "vitest";
import {
	getPasswordLength,
	getPasswordPolicyIssues,
	getPasswordValidationMessage,
	isPasswordPolicyCompliant,
} from "$lib/utils/auth/passwordPolicy";

describe("password policy", () => {
	it("accepts long passphrases without composition rules", () => {
		expect(isPasswordPolicyCompliant("violet river paper orchard")).toBe(true);
	});

	it("counts Unicode code points rather than UTF-16 units", () => {
		expect(getPasswordLength("🍓🍓🍓🍓🍓🍓🍓🍓🍓🍓🍓🍓🍓🍓🍓")).toBe(15);
	});

	it("rejects short passwords", () => {
		expect(getPasswordPolicyIssues("short password")).toContainEqual(
			expect.objectContaining({ code: "too_short" }),
		);
	});

	it("rejects known common passwords", () => {
		expect(getPasswordPolicyIssues("passwordpassword")).toContainEqual(
			expect.objectContaining({ code: "common" }),
		);
	});

	it("rejects the email name inside a password", () => {
		expect(
			getPasswordPolicyIssues("dylan-is-making-recipes", "dylan@example.com"),
		).toContainEqual(expect.objectContaining({ code: "contains_email" }));
	});

	it("requires matching confirmation after policy validation", () => {
		expect(
			getPasswordValidationMessage(
				"violet river paper orchard",
				"different long passphrase",
			),
		).toBe("Passwords do not match.");
	});
});
