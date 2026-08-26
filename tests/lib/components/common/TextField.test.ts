import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import TextField from "$lib/components/common/forms/TextField/TextField.svelte";

describe("TextField", () => {
	it("associates its label and helper with a single-line input", () => {
		render(TextField, {
			props: {
				id: "preferred-name",
				name: "displayName",
				label: "Preferred name",
				helper: "This stays separate from your email.",
				value: "Dylan",
			},
		});

		const input = screen.getByRole("textbox", { name: "Preferred name" });
		expect(input).toHaveValue("Dylan");
		expect(input).toHaveAccessibleDescription(
			"This stays separate from your email.",
		);
	});

	it("renders multiline values and forwards keyboard interaction", async () => {
		const onkeydown = vi.fn();
		render(TextField, {
			props: {
				id: "profile-bio",
				label: "Bio",
				value: "A short bio",
				multiline: true,
				onkeydown,
			},
		});

		const textarea = screen.getByRole("textbox", { name: "Bio" });
		expect(textarea).toHaveValue("A short bio");
		await fireEvent.keyDown(textarea, { key: "Enter" });
		expect(onkeydown).toHaveBeenCalledOnce();
	});

	it("shows and updates an accessible character count when requested", async () => {
		render(TextField, {
			props: {
				id: "profile-bio",
				label: "Bio",
				value: "Hello",
				maxlength: 150,
				showCharacterCount: true,
				multiline: true,
			},
		});

		const textarea = screen.getByRole("textbox", { name: "Bio" });
		expect(textarea).toHaveAttribute("maxlength", "150");
		expect(screen.getByText("5 / 150")).toBeVisible();
		expect(textarea).toHaveAccessibleDescription("145 characters remaining");

		await fireEvent.input(textarea, { target: { value: "Hello there" } });
		expect(screen.getByText("11 / 150")).toBeVisible();
		expect(textarea).toHaveAccessibleDescription("139 characters remaining");
	});
});
