import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import LandingPage from "../../src/routes/+page.svelte";
import StarterPage from "../../src/routes/fridge/+page.svelte";

describe("skeleton pages", () => {
	it("renders the starter landing page with auth link", () => {
		render(LandingPage, {
			props: {
				data: {
					authUser: null,
					next: "/fridge",
				},
			},
		});

		expect(screen.getByText("Blank app skeleton")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Sign in to continue →" })).toHaveAttribute(
			"href",
			"/auth?next=%2Ffridge",
		);
	});

	it("renders a protected starter workspace placeholder", () => {
		render(StarterPage);

		expect(screen.getByText("Starter workspace")).toBeInTheDocument();
		expect(
			screen.getByText("You are signed in. Use this protected route as your first feature page and build from here."),
		).toBeInTheDocument();
	});
});
