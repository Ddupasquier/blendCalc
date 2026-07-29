import { fireEvent, render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";

const children = createRawSnippet(() => ({
	render: () => "<p>Collapsed content</p>",
}));
const summaryEnd = createRawSnippet(() => ({
	render: () => '<span data-testid="summary-end">Moderator</span>',
}));

describe("CollapsibleSection", () => {
	it("uses the shared closed state with a left chevron and right-side action", async () => {
		render(CollapsibleSection, {
			props: {
				title: "Adjust card image placement",
				titleId: "image-placement-title",
				badge: "optional",
				summaryEnd,
				children,
			},
		});

		const title = screen.getByText("Adjust card image placement");
		const summary = title.closest("summary");
		const details = summary?.closest("details");
		const chevron = summary?.querySelector(".collapsible-section__chevron");
		const endAction = screen.getByTestId("summary-end");

		expect(details).not.toHaveAttribute("open");
		expect(chevron?.compareDocumentPosition(title) ?? 0)
			.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(title.compareDocumentPosition(endAction))
			.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(screen.getByText("optional")).toBeInTheDocument();
		expect(title).toHaveAttribute("id", "image-placement-title");

		await fireEvent.click(summary as HTMLElement);
		expect(details).toHaveAttribute("open");
	});
});
