import { render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import StatusIconBadge from "$lib/components/common/badges/StatusIconBadge/StatusIconBadge.svelte";

describe("StatusIconBadge", () => {
	it("provides one shared circular container for status icons", () => {
		const children = createRawSnippet(() => ({
			render: () => '<svg aria-hidden="true" viewBox="0 0 10 10"></svg>',
		}));

		render(StatusIconBadge, {
			props: {
				label: "Potential food conflict",
				children,
			},
		});

		const badge = screen.getByRole("img", { name: "Potential food conflict" });
		expect(badge).toHaveClass("status-icon-badge");
		expect(badge).toHaveAttribute("data-tone", "warning");
		expect(badge.querySelector(".centered-icon")).toBeInTheDocument();
		expect(badge.querySelector("svg")).toBeInTheDocument();
	});
});
