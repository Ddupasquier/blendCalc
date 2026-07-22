import { render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import InputLoadingFrame from "$lib/components/common/forms/InputLoadingFrame/InputLoadingFrame.svelte";

const input = createRawSnippet(() => ({
	render: () => '<input aria-label="Barcode" />',
}));

describe("InputLoadingFrame", () => {
	it("places an announced spinner inside a loading input", () => {
		const { container } = render(InputLoadingFrame, {
			props: {
				loading: true,
				loadingLabel: "Checking barcode sources",
				children: input,
			},
		});

		expect(screen.getByRole("textbox", { name: "Barcode" })).toBeInTheDocument();
		expect(
			screen.getByRole("status", { name: "Checking barcode sources" }),
		).toBeInTheDocument();
		expect(container.querySelector(".input-loading-frame")).toHaveAttribute(
			"aria-busy",
			"true",
		);
	});

	it("does not reserve a loading state after the request finishes", () => {
		const { container } = render(InputLoadingFrame, {
			props: { children: input },
		});

		expect(screen.queryByRole("status")).not.toBeInTheDocument();
		expect(container.querySelector(".input-loading-frame")).not.toHaveClass(
			"input-loading-frame--loading",
		);
	});
});
