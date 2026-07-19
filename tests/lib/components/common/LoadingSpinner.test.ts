import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner.svelte";

describe("LoadingSpinner", () => {
	it("announces an accessible label and uses the requested shared size", () => {
		const { container } = render(LoadingSpinner, {
			props: {
				label: "Loading ingredients",
				size: "large",
			},
		});

		const status = screen.getByRole("status", { name: "Loading ingredients" });
		expect(status).toHaveAttribute("data-size", "large");
		expect(container.querySelector(".loading-spinner__ring")).toBeInTheDocument();
	});

	it("can show its label without creating a duplicate accessible name", () => {
		render(LoadingSpinner, {
			props: {
				label: "Loading saved ingredients",
				showLabel: true,
			},
		});

		expect(screen.getByRole("status")).toHaveTextContent(
			"Loading saved ingredients",
		);
	});

	it("stays decorative when a parent control already owns the busy state", () => {
		const { container } = render(LoadingSpinner, {
			props: { decorative: true },
		});

		expect(screen.queryByRole("status")).not.toBeInTheDocument();
		expect(container.querySelector(".loading-spinner")).toHaveAttribute(
			"aria-hidden",
			"true",
		);
	});
});
