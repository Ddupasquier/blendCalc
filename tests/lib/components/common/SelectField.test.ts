import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";

describe("SelectField unavailable-choice contract", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("keeps a disabled source value visible but unavailable", async () => {
		render(SelectField, {
			props: {
				id: "region",
				ariaLabel: "Package-label region",
				value: "",
				options: [
					{ value: "", label: "Personal settings only" },
					{
						value: "legacy",
						label: "Saved region unavailable",
						disabled: true,
					},
				],
			},
		});

		const combobox = screen.getByRole("combobox", {
			name: "Package-label region",
		});
		await fireEvent.click(combobox);
		expect(
			screen.getByRole("option", { name: "Saved region unavailable" }),
		).toBeDisabled();
	});

	it("expands in place without synchronous geometry measurement", async () => {
		const measure = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");

		const { container } = render(SelectField, {
			props: {
				id: "destination",
				ariaLabel: "Add after saving",
				value: "fridge",
				options: [
					{ value: "fridge", label: "Fridge" },
					{ value: "shopping", label: "Shopping List" },
				],
			},
		});

		const combobox = screen.getByRole("combobox", {
			name: "Add after saving",
		});
		await fireEvent.click(combobox);

		const listbox = await screen.findByRole("listbox", {
			name: "Add after saving",
		});
		expect(measure).not.toHaveBeenCalled();
		expect(container.contains(listbox)).toBe(true);
	});
});
