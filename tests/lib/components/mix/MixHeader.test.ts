import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import MixHeader from "$lib/components/mix/layout/MixHeader/MixHeader.svelte";

describe("MixHeader", () => {
	it("uses circular icon actions and opens the options sheet trigger", async () => {
		const onOpenOptions = vi.fn();
		const onSave = vi.fn();

		render(MixHeader, {
			props: {
				canSave: true,
				optionsOpen: false,
				onOpenOptions,
				onSave,
			},
		});

		const optionsButton = screen.getByRole("button", { name: "Open mix options" });
		const saveButton = screen.getByRole("button", { name: "Save mix" });

		expect(optionsButton).toHaveAttribute("aria-expanded", "false");
		expect(optionsButton).toHaveClass("circle-icon-button", "mix-header__action");
		expect(saveButton).toHaveClass(
			"circle-icon-button",
			"mix-header__action",
			"mix-header__save",
		);

		await fireEvent.click(optionsButton);
		await fireEvent.click(saveButton);

		expect(onOpenOptions).toHaveBeenCalledOnce();
		expect(onSave).toHaveBeenCalledOnce();
	});

	it("places the unsaved status below the title and keeps friendly guidance visible", () => {
		const { container } = render(MixHeader, {
			props: {
				canSave: true,
				isDirty: true,
				onOpenOptions: vi.fn(),
				onSave: vi.fn(),
			},
		});

		const copy = container.querySelector(".mix-header__copy");
		const children = Array.from(copy?.children ?? []);

		expect(children[0]).toHaveTextContent("Mix.");
		expect(children[1]).toHaveTextContent("Unsaved changes");
		expect(children[2]).toHaveTextContent(
			"Build something delicious and watch your nutrition goals take shape.",
		);
	});
});
