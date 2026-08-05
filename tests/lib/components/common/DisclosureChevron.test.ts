import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import DisclosureChevron from "$lib/components/common/disclosure/DisclosureChevron/DisclosureChevron.svelte";

describe("DisclosureChevron", () => {
	it("renders a right-facing closed indicator", () => {
		const { container } = render(DisclosureChevron);
		const chevron = container.querySelector(".disclosure-chevron");

		expect(chevron).not.toHaveAttribute("data-open");
		expect(chevron?.querySelector("path"))
			.toHaveAttribute("transform", "rotate(-90 12 12)");
	});

	it("exposes explicit open state for non-details disclosures", () => {
		const { container } = render(DisclosureChevron, { props: { open: true } });

		expect(container.querySelector(".disclosure-chevron"))
			.toHaveAttribute("data-open", "true");
	});
});
