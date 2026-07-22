import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import RoundedActionLink from "$lib/components/common/buttons/RoundedActionLink/RoundedActionLink.svelte";

describe("RoundedActionLink", () => {
	it("uses the shared rounded action treatment for navigation", () => {
		render(RoundedActionLink, {
			props: {
				href: "/profile/tutorial",
				ariaLabel: "Open quick tutorial",
			},
		});

		const link = screen.getByRole("link", { name: "Open quick tutorial" });
		expect(link).toHaveAttribute("href", "/profile/tutorial");
		expect(link).toHaveClass("rounded-action-button");
	});
});
