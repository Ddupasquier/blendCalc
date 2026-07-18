import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import VerifiedStatusBadge from "$lib/components/common/badges/VerifiedStatusBadge.svelte";

describe("VerifiedStatusBadge", () => {
	it("renders the shared shield-check inside the centered circular badge", () => {
		render(VerifiedStatusBadge, { props: { label: "Verified" } });

		const badge = screen.getByRole("img", {
			name: "Review status: Verified",
		});
		expect(badge).toHaveClass("verified-status-badge");
		expect(badge).toHaveClass("status-icon-badge");
		expect(badge).toHaveClass("circular-icon-frame");
		expect(badge).toHaveAttribute("data-tone", "success");
		expect(badge).toHaveAttribute("title", "Verified");
		expect(badge.querySelector(".centered-icon")).toBeInTheDocument();
		expect(badge.querySelector("svg")).toBeInTheDocument();
		expect(badge).not.toHaveTextContent("Verified");
	});
});
