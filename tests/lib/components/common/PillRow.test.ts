import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import PillRow from "$lib/components/common/PillRow.svelte";

const getPillLabels = () =>
	screen
		.getAllByRole("button")
		.filter((button) => button.classList.contains("pill"))
		.map((button) => button.textContent?.replace("×", "").trim());

describe("PillRow", () => {
	it("keeps the existing compact arrangement by default", () => {
		render(PillRow, {
			props: {
				pills: ["Kale, raw", "Apple", "Banana"],
				onRemove: vi.fn(),
			},
		});

		expect(getPillLabels()).toEqual(["Apple", "Banana", "Kale, raw"]);
	});

	it("preserves incoming order when requested", () => {
		render(PillRow, {
			props: {
				pills: ["Kale, raw", "Apple", "Banana"],
				onRemove: vi.fn(),
				preserveOrder: true,
			},
		});

		expect(getPillLabels()).toEqual(["Kale, raw", "Apple", "Banana"]);
	});

	it("renders custom ingredients with a badge", () => {
		render(PillRow, {
			props: {
				pills: ["User yogurt"],
				customIndices: [0],
				onRemove: vi.fn(),
			},
		});

		expect(screen.getByText("Custom")).toBeInTheDocument();
	});

	it("calls rename with the original pill index", async () => {
		const onRename = vi.fn();
		render(PillRow, {
			props: {
				pills: ["Long ingredient name", "Egg"],
				onRemove: vi.fn(),
				onRename,
			},
		});

		await fireEvent.click(
			screen.getByRole("button", { name: "Rename Long ingredient name" }),
		);

		expect(onRename).toHaveBeenCalledWith(0);
	});
});
