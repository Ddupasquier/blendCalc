import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import NumberInput from "$lib/components/common/forms/NumberInput/NumberInput.svelte";

describe("NumberInput", () => {
	it("keeps an absent value empty and exposes a placeholder", () => {
		render(NumberInput, { props: { value: null, placeholder: "e.g. 30" } });
		const input = screen.getByPlaceholderText("e.g. 30") as HTMLInputElement;

		expect(input.value).toBe("");
	});

	it("reports empty input as unknown instead of zero", async () => {
		const onValueChange = vi.fn();
		render(NumberInput, { props: { value: 6, placeholder: "0", onValueChange } });
		const input = screen.getByRole("spinbutton") as HTMLInputElement;

		await fireEvent.input(input, { target: { value: "" } });

		expect(onValueChange).toHaveBeenLastCalledWith("", null, expect.any(Event));
	});

	it("selects the existing value on focus", async () => {
		const select = vi.spyOn(HTMLInputElement.prototype, "select");
		render(NumberInput, { props: { value: 60, placeholder: "0" } });
		const input = screen.getByRole("spinbutton") as HTMLInputElement;

		await fireEvent.focus(input);

		expect(select).toHaveBeenCalledOnce();
		expect(select).toHaveBeenCalledWith();
	});
});
