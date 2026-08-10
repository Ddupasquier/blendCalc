import { render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";

describe("RoundedActionButton", () => {
	it("supports alternate form actions without bypassing the shared button", () => {
		render(RoundedActionButton, {
			props: {
				type: "submit",
				formAction: "?/removeAvatar",
				formNoValidate: true,
				children: createRawSnippet(() => ({ render: () => "<span>Remove image</span>" })),
			},
		});

		const button = screen.getByRole("button", { name: "Remove image" });
		expect(button).toHaveAttribute("formaction", "?/removeAvatar");
		expect(button).toHaveAttribute("formnovalidate");
	});
});
