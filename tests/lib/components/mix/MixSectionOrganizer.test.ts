import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import MixSectionOrganizer from "$lib/components/mix/layout/MixSectionOrganizer/MixSectionOrganizer.svelte";
import { DEFAULT_MIX_SECTION_ORDER } from "$lib/utils/mix/ui/mixSectionOrder";

const labels = () =>
	screen
		.getAllByRole("listitem")
		.map((item) => item.querySelector(".mix-section-organizer__label")?.textContent);

describe("MixSectionOrganizer", () => {
	it("shows only compact section headers with accessible move controls", async () => {
		const onOrderChange = vi.fn();
		const onOrderCommit = vi.fn();
		render(MixSectionOrganizer, {
			props: {
				order: [...DEFAULT_MIX_SECTION_ORDER],
				onOrderChange,
				onOrderCommit,
				onDone: vi.fn(),
			},
		});

		expect(labels()).toEqual([
			"Nutrient shape",
			"Goals",
			"Selected ingredients",
			"Add ingredients",
			"Warnings",
			"Suggested adjustments",
			"What is driving this shape",
		]);

		await fireEvent.click(
			screen.getByRole("button", { name: "Move Nutrient shape down" }),
		);

		expect(labels().slice(0, 2)).toEqual(["Goals", "Nutrient shape"]);
		expect(onOrderChange).toHaveBeenCalledOnce();
		expect(onOrderCommit).toHaveBeenCalledOnce();
	});

	it("keeps a fast pointer drag captured by the stable organizer", async () => {
		const onOrderChange = vi.fn();
		const onOrderCommit = vi.fn();
		const { container } = render(MixSectionOrganizer, {
			props: {
				order: [...DEFAULT_MIX_SECTION_ORDER],
				onOrderChange,
				onOrderCommit,
				onDone: vi.fn(),
			},
		});
		const organizer = container.querySelector<HTMLElement>(".mix-section-organizer");
		if (!organizer) throw new Error("Organizer did not render");
		const setPointerCapture = vi.fn();
		const releasePointerCapture = vi.fn();
		Object.defineProperties(organizer, {
			setPointerCapture: { value: setPointerCapture },
			hasPointerCapture: { value: () => true },
			releasePointerCapture: { value: releasePointerCapture },
		});

		screen.getAllByRole("listitem").forEach((item, index) => {
			vi.spyOn(item, "getBoundingClientRect").mockReturnValue({
				x: 0,
				y: index * 60,
				top: index * 60,
				left: 0,
				right: 320,
				bottom: index * 60 + 50,
				width: 320,
				height: 50,
				toJSON: () => ({}),
			});
		});

		await fireEvent.pointerDown(
			screen.getByRole("button", { name: "Drag Nutrient shape to reorder" }),
			{ button: 0, pointerId: 17, clientY: 25 },
		);
		const draggedItem = container.querySelector<HTMLElement>(
			".mix-section-organizer__item--dragging",
		);
		expect(draggedItem).toHaveStyle({
			top: "0px",
			left: "0px",
			width: "320px",
			height: "50px",
		});
		await fireEvent.pointerMove(organizer, { pointerId: 17, clientY: 415 });

		expect(setPointerCapture).toHaveBeenCalledWith(17);
		expect(draggedItem).toHaveStyle({ top: "390px" });
		expect(
			container.querySelector<HTMLElement>("[data-mix-drag-preview]"),
		).toBe(draggedItem);
		expect(labels().at(-1)).toBe("Nutrient shape");
		expect(onOrderChange).toHaveBeenCalledOnce();

		await fireEvent.pointerUp(organizer, { pointerId: 17, clientY: 415 });

		expect(releasePointerCapture).toHaveBeenCalledWith(17);
		expect(onOrderCommit).toHaveBeenCalledOnce();
	});

	it("lets the active row follow the pointer before its insertion slot changes", async () => {
		const onOrderChange = vi.fn();
		const { container } = render(MixSectionOrganizer, {
			props: {
				order: [...DEFAULT_MIX_SECTION_ORDER],
				onOrderChange,
				onOrderCommit: vi.fn(),
				onDone: vi.fn(),
			},
		});
		const organizer = container.querySelector<HTMLElement>(
			".mix-section-organizer",
		);
		if (!organizer) throw new Error("Organizer did not render");
		Object.defineProperties(organizer, {
			setPointerCapture: { value: vi.fn() },
			hasPointerCapture: { value: () => true },
			releasePointerCapture: { value: vi.fn() },
		});

		screen.getAllByRole("listitem").forEach((item, index) => {
			vi.spyOn(item, "getBoundingClientRect").mockReturnValue({
				x: 0,
				y: index * 60,
				top: index * 60,
				left: 0,
				right: 320,
				bottom: index * 60 + 50,
				width: 320,
				height: 50,
				toJSON: () => ({}),
			});
		});

		await fireEvent.pointerDown(
			screen.getByRole("button", { name: "Drag Nutrient shape to reorder" }),
			{ button: 0, pointerId: 23, clientY: 25 },
		);
		await fireEvent.pointerMove(organizer, { pointerId: 23, clientY: 70 });

		const draggedItem = container.querySelector<HTMLElement>(
			".mix-section-organizer__item--dragging",
		);
		expect(draggedItem).toHaveStyle({ top: "45px" });
		expect(labels().slice(0, 2)).toEqual(["Nutrient shape", "Goals"]);
		expect(onOrderChange).not.toHaveBeenCalled();

		await fireEvent.pointerMove(organizer, { pointerId: 23, clientY: 90 });

		expect(draggedItem).toHaveStyle({ top: "65px" });
		expect(
			container.querySelector<HTMLElement>("[data-mix-drag-preview]"),
		).toBe(draggedItem);
		expect(labels().slice(0, 2)).toEqual(["Goals", "Nutrient shape"]);
		expect(onOrderChange).toHaveBeenCalledOnce();
	});
});
