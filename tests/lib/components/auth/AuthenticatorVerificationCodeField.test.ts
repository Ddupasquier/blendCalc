import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import AuthenticatorVerificationCodeField from "$lib/components/auth/AuthenticatorVerificationCodeField/AuthenticatorVerificationCodeField.svelte";

describe("AuthenticatorVerificationCodeField", () => {
	it("accepts the six-digit code format shown by authenticator apps", async () => {
		render(AuthenticatorVerificationCodeField);
		const input = screen.getByLabelText("Six-digit code") as HTMLInputElement;

		expect(input).toHaveAttribute("inputmode", "numeric");
		expect(input).toHaveAttribute("autocomplete", "one-time-code");
		expect(input).not.toHaveAttribute("pattern");
		expect(input).not.toHaveAttribute("maxlength");

		await fireEvent.input(input, { target: { value: "123 456" } });

		expect(input.value).toBe("123 456");
		expect(screen.getByText("Use the current code shown in your app—not the example. Spaces are okay."))
			.toBeInTheDocument();
	});

	it("exposes rejected codes as invalid without changing the field contract", () => {
		render(AuthenticatorVerificationCodeField, {
			props: { invalid: true },
		});

		expect(screen.getByLabelText("Six-digit code"))
			.toHaveAttribute("aria-invalid", "true");
	});
});
