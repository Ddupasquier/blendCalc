import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import MetadataPill from "$lib/components/common/display/MetadataPill/MetadataPill.svelte";

describe("MetadataPill", () => {
	it("renders compact metadata with a semantic tone and optional value", () => {
		render(MetadataPill, {
			props: {
				label: "Protein",
				value: "82%",
				tone: "success",
				ariaLabel: "Protein goal progress: 82%",
			},
		});

		const pill = screen.getByLabelText("Protein goal progress: 82%");
		expect(pill).toHaveAttribute("data-tone", "success");
		expect(screen.getByText("Protein")).toBeInTheDocument();
		expect(screen.getByText("82%")).toBeInTheDocument();
	});
});
