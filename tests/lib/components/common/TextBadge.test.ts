import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";

describe("TextBadge", () => {
	it("renders centered metadata through the shared badge primitive", () => {
		render(TextBadge, {
			props: {
				label: "Custom",
				ariaLabel: "Source: Custom",
				tone: "custom",
			},
		});

		const badge = screen.getByLabelText("Source: Custom");
		expect(badge).toHaveClass("text-badge");
		expect(badge).toHaveAttribute("data-tone", "custom");
		expect(badge).toHaveTextContent("Custom");
	});
});
