import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";

describe("SelectField", () => {
	it("keeps form value semantics behind an accessible styled combobox", async () => {
		const onValueChange = vi.fn();
		const { container } = render(SelectField, {
			props: {
				id: "destination",
				name: "destination",
				label: "Add after saving",
				value: "fridge",
				options: [
					{ value: "fridge", label: "Fridge" },
					{ value: "shopping", label: "Shopping List" },
				],
				helper: "Choose where this ingredient should appear.",
				onValueChange,
			},
		});

		const combobox = screen.getByRole("combobox", { name: "Add after saving" });
		const nativeSelect = container.querySelector<HTMLSelectElement>(
			'select[name="destination"]',
		);
		expect(combobox).toHaveTextContent("Fridge");
		expect(combobox).toHaveAttribute("aria-describedby", "destination-helper");
		expect(nativeSelect).toHaveValue("fridge");
		expect(screen.getByText("Choose where this ingredient should appear.")).toBeVisible();

		await fireEvent.click(combobox);
		expect(combobox).toHaveAttribute("aria-expanded", "true");
		await fireEvent.click(screen.getByRole("option", { name: "Shopping List" }));

		expect(combobox).toHaveTextContent("Shopping List");
		expect(combobox).toHaveAttribute("aria-expanded", "false");
		expect(nativeSelect).toHaveValue("shopping");
		expect(onValueChange).toHaveBeenCalledWith("shopping");
	});

	it("supports external labels and keeps disabled choices unavailable", async () => {
		render(SelectField, {
			props: {
				id: "region",
				ariaLabel: "Package-label region",
				value: "",
				options: [
					{ value: "", label: "Personal settings only" },
					{ value: "legacy", label: "Saved region unavailable", disabled: true },
				],
			},
		});

		const combobox = screen.getByRole("combobox", {
			name: "Package-label region",
		});
		expect(combobox).toBeEnabled();
		await fireEvent.click(combobox);
		expect(screen.getByRole("option", { name: "Saved region unavailable" })).toBeDisabled();
	});

	it("supports keyboard navigation, skips disabled choices, and closes on escape", async () => {
		const onValueChange = vi.fn();
		render(SelectField, {
			props: {
				id: "sort-order",
				label: "Sort order",
				value: "recent",
				options: [
					{ value: "recent", label: "Most recent" },
					{ value: "unavailable", label: "Unavailable", disabled: true },
					{ value: "name", label: "Name" },
				],
				onValueChange,
			},
		});

		const combobox = screen.getByRole("combobox", { name: "Sort order" });
		await fireEvent.keyDown(combobox, { key: "ArrowDown" });
		await fireEvent.keyDown(combobox, { key: "ArrowDown" });
		await fireEvent.keyDown(combobox, { key: "Enter" });

		expect(onValueChange).toHaveBeenCalledWith("name");
		expect(combobox).toHaveTextContent("Name");

		await fireEvent.click(combobox);
		await fireEvent.keyDown(combobox, { key: "Escape" });
		expect(combobox).toHaveAttribute("aria-expanded", "false");
	});
});
