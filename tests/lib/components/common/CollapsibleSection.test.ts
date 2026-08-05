import { fireEvent, render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it, vi } from "vitest";
import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";

const children = createRawSnippet(() => ({
	render: () => "<p>Collapsed content</p>",
}));
const summaryEnd = createRawSnippet(() => ({
	render: () => '<span data-testid="summary-end">Moderator</span>',
}));

describe("CollapsibleSection", () => {
	it("uses a right-facing closed chevron and rotates it down when opened", async () => {
		render(CollapsibleSection, {
			props: {
				title: "Adjust card image placement",
				titleId: "image-placement-title",
				badge: "optional",
				surface: "panel",
				summaryEnd,
				children,
			},
		});

		const title = screen.getByText("Adjust card image placement");
		const summary = title.closest("summary");
		const details = summary?.closest("details");
		const chevron = summary?.querySelector(".collapsible-section__chevron");
		const chevronPath = chevron?.querySelector("path");
		const endAction = screen.getByTestId("summary-end");

		expect(details).not.toHaveAttribute("open");
		expect(details).toHaveAttribute("data-surface", "panel");
		expect(chevronPath).toHaveAttribute("transform", "rotate(-90 12 12)");
		expect(chevron?.compareDocumentPosition(title) ?? 0)
			.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(title.compareDocumentPosition(endAction))
			.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(screen.getByText("optional")).toBeInTheDocument();
		expect(title).toHaveAttribute("id", "image-placement-title");

		await fireEvent.click(summary as HTMLElement);
		expect(details).toHaveAttribute("open");
		expect(details).toHaveAttribute("data-expanded", "true");
		expect(summary).toHaveAttribute("aria-expanded", "true");

		await fireEvent.click(summary as HTMLElement);
		expect(details).not.toHaveAttribute("open");
		expect(details).toHaveAttribute("data-expanded", "false");
		expect(summary).toHaveAttribute("aria-expanded", "false");
	});

	it("reports controlled state changes and exposes closed danger attention", async () => {
		const onOpenChange = vi.fn();
		render(CollapsibleSection, {
			props: {
				title: "Warnings",
				tone: "danger",
				onOpenChange,
				children,
			},
		});

		const summary = screen.getByText("Warnings").closest("summary");
		const details = summary?.closest("details");
		expect(details).toHaveAttribute("data-tone", "danger");
		expect(screen.getByText("Urgent attention needed.")).toBeInTheDocument();

		await fireEvent.click(summary as HTMLElement);
		expect(onOpenChange).toHaveBeenCalledWith(true);
	});
});
