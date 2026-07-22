import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import AssetAttribution from "$lib/components/common/display/AssetAttribution/AssetAttribution.svelte";

describe("AssetAttribution", () => {
	it("shows stored credit and links the stored license", () => {
		render(AssetAttribution, {
			props: {
				attributionText: "Example contributors",
				licenseName: "Example license",
				licenseUrl: "https://example.com/license",
			},
		});

		expect(screen.getByText("Image: Example contributors")).toBeInTheDocument();
		expect(
			screen.getByRole("link", {
				name: "Example license (opens in a new tab)",
			}),
		).toHaveAttribute("href", "https://example.com/license");
		expect(screen.getByRole("link")).toHaveAttribute("target", "_blank");
		expect(screen.getByRole("link")).toHaveAttribute(
			"rel",
			"noopener noreferrer",
		);
	});

	it("renders stored license text without inventing a link", () => {
		render(AssetAttribution, {
			props: {
				licenseName: "Community submitted product image",
			},
		});

		expect(screen.getByText("Image license")).toBeInTheDocument();
		expect(screen.getByText("Community submitted product image"))
			.toBeInTheDocument();
		expect(screen.queryByRole("link")).not.toBeInTheDocument();
	});
});
