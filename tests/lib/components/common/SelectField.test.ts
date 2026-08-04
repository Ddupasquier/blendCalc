import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";

describe("SelectField", () => {
	it("renders one accessible native select with shared options and helper copy", async () => {
		const onValueChange = vi.fn();
		render(SelectField, {
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

		const select = screen.getByRole("combobox", { name: "Add after saving" });
		expect(select).toHaveValue("fridge");
		expect(select).toHaveAttribute("aria-describedby", "destination-helper");
		expect(screen.getByText("Choose where this ingredient should appear.")).toBeVisible();

		await fireEvent.change(select, { target: { value: "shopping" } });
		expect(onValueChange).toHaveBeenCalledWith("shopping");
	});

	it("supports an external label and disabled options", () => {
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

		const select = screen.getByRole("combobox", {
			name: "Package-label region",
		});
		expect(select).toBeEnabled();
		expect(screen.getByRole("option", { name: "Saved region unavailable" })).toBeDisabled();
	});
});
