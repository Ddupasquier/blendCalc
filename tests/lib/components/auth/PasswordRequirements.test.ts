import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import PasswordRequirements from "$lib/components/auth/PasswordRequirements/PasswordRequirements.svelte";

describe("PasswordRequirements", () => {
	it("announces a mismatch after confirmation entry and clears it when values match", async () => {
		const view = render(PasswordRequirements, {
			props: {
				password: "one sufficiently long passphrase",
				confirmation: "a different long passphrase",
			},
		});

		expect(screen.getByText("Passwords do not match")).toHaveAttribute(
			"aria-live",
			"polite",
		);

		await view.rerender({
			password: "one sufficiently long passphrase",
			confirmation: "one sufficiently long passphrase",
		});

		expect(screen.getByText("Passwords match")).toHaveClass("valid");
		expect(
			screen.queryByText("Passwords do not match"),
		).not.toBeInTheDocument();

		await view.rerender({
			password: "a newly changed long passphrase",
			confirmation: "one sufficiently long passphrase",
		});

		expect(screen.getByText("Passwords do not match")).toHaveClass("invalid");
	});
});
