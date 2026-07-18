import { render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";

import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame.svelte";

describe("CircularIconFrame", () => {
	it("centers every supplied icon through the shared inner wrapper", () => {
		const children = createRawSnippet(() => ({
			render: () => '<svg aria-hidden="true" viewBox="0 0 24 24"></svg>',
		}));

		render(CircularIconFrame, {
			props: {
				label: "Warning",
				children,
			},
		});

		const frame = screen.getByRole("img", { name: "Warning" });
		expect(frame).toHaveClass("circular-icon-frame");
		expect(frame.querySelector(".centered-icon > svg")).toBeInTheDocument();
	});
});
