import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import PillRow from "$lib/components/common/display/PillRow/PillRow.svelte";

const getPillLabels = () =>
	Array.from(document.querySelectorAll(".pill-label")).map((label) =>
		label.textContent?.trim(),
	);

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

	it("does not create a no-op selection control when only removal is available", () => {
		render(PillRow, {
			props: {
				pills: ["Apple"],
				onRemove: vi.fn(),
			},
		});

		expect(screen.getByText("Apple").closest("button")).toBeNull();
		expect(screen.getByRole("button", { name: "Remove Apple" })).toBeInTheDocument();
	});
});
