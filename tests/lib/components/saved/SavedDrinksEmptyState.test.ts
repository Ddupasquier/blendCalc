import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import SavedDrinksEmptyState from "$lib/components/saved/SavedDrinksEmptyState/SavedDrinksEmptyState.svelte";

describe("SavedDrinksEmptyState", () => {
	it("guides an empty library back to Mix", async () => {
		const onAction = vi.fn();
		render(SavedDrinksEmptyState, { props: { onAction } });

		expect(
			screen.getByRole("heading", {
				name: "Save a favorite for next time",
			}),
		).toBeInTheDocument();
		await fireEvent.click(screen.getByRole("button", { name: "Build a mix" }));
		expect(onAction).toHaveBeenCalledOnce();
	});

	it("uses a focused recovery action for filtered results", async () => {
		const onAction = vi.fn();
		render(SavedDrinksEmptyState, {
			props: { filtered: true, onAction },
		});

		expect(
			screen.getByRole("heading", { name: "No saved mixes found" }),
		).toBeInTheDocument();
		await fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
		expect(onAction).toHaveBeenCalledOnce();
	});
});
