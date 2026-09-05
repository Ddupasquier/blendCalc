import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";

describe("SelectField unavailable-choice contract", () => {
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
});
