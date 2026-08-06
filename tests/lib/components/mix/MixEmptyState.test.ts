import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import MixEmptyState from "$lib/components/mix/states/MixEmptyState/MixEmptyState.svelte";

describe("MixEmptyState", () => {
	it("offers one concise next step using the shared action link", () => {
		render(MixEmptyState);

		expect(
			screen.getByRole("heading", { name: "No ingredients selected" }),
		).toBeInTheDocument();
		expect(screen.getByText(/open add ingredients/i)).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Manage ingredients" }),
		).toHaveAttribute("href", "/ingredients/fridge");
		expect(screen.queryByText(/four steps/i)).not.toBeInTheDocument();
	});
});
