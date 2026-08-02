import { render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";

const label = createRawSnippet(() => ({
	render: () => "<span>Save product</span>",
}));
const icon = createRawSnippet(() => ({
	render: () => '<svg aria-hidden="true"></svg>',
}));

describe("shared button loading states", () => {
	it("keeps a stable action label beside the reusable spinner", () => {
		const { container } = render(ActionButton, {
			props: { busy: true, children: label },
		});

		const button = screen.getByRole("button", { name: "Save product" });
		expect(button).toBeDisabled();
		expect(button).toHaveAttribute("aria-busy", "true");
		expect(container.querySelector(".loading-spinner__ring")).toBeInTheDocument();
	});

	it("replaces a circular action icon with the same spinner while busy", () => {
		const { container } = render(CircleIconButton, {
			props: {
				label: "Add ingredient",
				busy: true,
				children: icon,
			},
		});

		expect(screen.getByRole("button", { name: "Add ingredient" })).toBeDisabled();
		expect(container.querySelector(".loading-spinner__ring")).toBeInTheDocument();
		expect(container.querySelector("svg")).not.toBeInTheDocument();
	});
});
