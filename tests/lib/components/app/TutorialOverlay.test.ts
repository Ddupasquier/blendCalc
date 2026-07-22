import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import TutorialOverlay from "$lib/components/app/TutorialOverlay/TutorialOverlay.svelte";

describe("TutorialOverlay", () => {
	it("moves through concise tutorial steps", async () => {
		render(TutorialOverlay, {
			props: {
				open: true,
				onRemindLater: vi.fn(() => true),
				onDontShowAgain: vi.fn(() => true),
			},
		});

		expect(
			screen.getByRole("heading", { name: "Build your ingredient lists" }),
		).toBeInTheDocument();
		expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();

		await fireEvent.click(screen.getByRole("button", { name: "Next" }));

		expect(
			screen.getByRole("heading", {
				name: "Choose what you want to track",
			}),
		).toBeInTheDocument();
		expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
	});

	it("records the selected automatic-display preference", async () => {
		const remindLater = vi.fn(() => true);
		const dontShowAgain = vi.fn(() => true);

		render(TutorialOverlay, {
			props: {
				open: true,
				onRemindLater: remindLater,
				onDontShowAgain: dontShowAgain,
			},
		});

		await fireEvent.click(
			screen.getByRole("button", { name: "Remind me in 7 days" }),
		);
		expect(remindLater).toHaveBeenCalledOnce();
		expect(dontShowAgain).not.toHaveBeenCalled();
	});

	it("keeps the tutorial open and explains a failed preference save", async () => {
		render(TutorialOverlay, {
			props: {
				open: true,
				onRemindLater: vi.fn(() => false),
				onDontShowAgain: vi.fn(() => false),
			},
		});

		await fireEvent.click(
			screen.getByRole("button", { name: "Don’t show again" }),
		);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"We could not save that choice. Please try again.",
		);
		expect(screen.getByRole("dialog")).toBeInTheDocument();
	});
});
