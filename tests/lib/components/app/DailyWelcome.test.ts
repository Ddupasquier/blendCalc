import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DailyWelcome from "$lib/components/app/DailyWelcome/DailyWelcome.svelte";

describe("DailyWelcome", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
	});

	it("shows the supplied name and dismisses when clicked", async () => {
		render(DailyWelcome, {
			props: {
				userId: "user-1",
				name: "Dylan",
			},
		});
		await tick();

		const welcome = screen.getByRole("button", {
			name: "Dismiss welcome message for Dylan",
		});
		expect(welcome).toHaveTextContent("Welcome back,");
		expect(welcome).toHaveTextContent("Dylan");

		await fireEvent.click(welcome);
		expect(screen.queryByText("Dylan")).not.toBeInTheDocument();
	});

	it("automatically dismisses after four seconds", async () => {
		render(DailyWelcome, {
			props: {
				userId: "user-1",
				name: "dylan@example.com",
			},
		});
		await tick();

		expect(screen.getByText("dylan@example.com")).toBeInTheDocument();

		vi.advanceTimersByTime(4_000);
		await tick();

		expect(screen.queryByText("dylan@example.com")).not.toBeInTheDocument();
	});
});
