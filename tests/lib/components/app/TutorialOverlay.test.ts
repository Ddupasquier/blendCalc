import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import TutorialOverlay from "$lib/components/app/TutorialOverlay/TutorialOverlay.svelte";

describe("TutorialOverlay", () => {
	it("moves through concise tutorial steps", async () => {
		render(TutorialOverlay, {
			props: {
				open: true,
				onFinish: vi.fn(() => true),
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

	it("finishes after the final step", async () => {
		const onFinish = vi.fn(() => true);

		render(TutorialOverlay, {
			props: {
				open: true,
				onFinish,
			},
		});

		for (let step = 1; step < 4; step += 1) {
			await fireEvent.click(screen.getByRole("button", { name: "Next" }));
		}
		await fireEvent.click(screen.getByRole("button", { name: "Finish tutorial" }));
		expect(onFinish).toHaveBeenCalledOnce();
	});

	it("keeps the tutorial open and explains a failed preference save", async () => {
		render(TutorialOverlay, {
			props: {
				open: true,
				onFinish: vi.fn(() => false),
			},
		});

		for (let step = 1; step < 4; step += 1) {
			await fireEvent.click(screen.getByRole("button", { name: "Next" }));
		}
		await fireEvent.click(screen.getByRole("button", { name: "Finish tutorial" }));

		expect(screen.getByRole("alert")).toHaveTextContent(
			"We could not save that choice. Please try again.",
		);
		expect(screen.getByRole("dialog")).toBeInTheDocument();
	});
});
