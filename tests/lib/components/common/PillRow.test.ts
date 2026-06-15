import { render, screen } from "@testing-library/svelte";
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
});
