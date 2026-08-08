import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import MixWarnings from "$lib/components/mix/insights/MixWarnings/MixWarnings.svelte";
import type { MixWarning } from "$lib/utils/mix/warnings/mixWarnings";

const renderWarnings = (warnings: MixWarning[]) =>
	render(MixWarnings, {
		props: {
			warnings,
			onOpenWarning: vi.fn(),
			onCloseWarning: vi.fn(),
		},
	});

describe("MixWarnings", () => {
	it("starts closed with a yellow section and neutral collapse header", () => {
		renderWarnings([
			{
				id: "low-warning",
				severity: "info",
				symbol: "?",
				title: "Check this ingredient",
				message: "Available data needs a closer look.",
			},
		]);

		const title = screen.getByText("Warnings");
		const disclosure = title.closest("details");
		const section = title.closest("section");
		expect(disclosure).not.toHaveAttribute("open");
		expect(disclosure).toHaveAttribute("data-tone", "neutral");
		expect(section).toHaveAttribute("data-attention-tone", "warning");
		expect(screen.getByRole("status")).toHaveTextContent("1 warning.");
		expect(disclosure).not.toHaveAttribute("aria-live");
	});

	it("starts closed with a red section when any warning is high severity", () => {
		renderWarnings([
			{
				id: "low-warning",
				severity: "warning",
				symbol: "!",
				title: "Fiber below target",
				message: "Fiber is below the current goal.",
			},
			{
				id: "high-warning",
				severity: "danger",
				symbol: "!",
				title: "Fat exceeds goal",
				message: "Fat exceeds the current goal.",
			},
		]);

		const title = screen.getByText("Warnings");
		const disclosure = title.closest("details");
		const section = title.closest("section");
		expect(disclosure).not.toHaveAttribute("open");
		expect(disclosure).toHaveAttribute("data-tone", "neutral");
		expect(section).toHaveAttribute("data-attention-tone", "danger");
		expect(screen.getByRole("status")).toHaveTextContent("2 urgent warnings.");
	});
});
