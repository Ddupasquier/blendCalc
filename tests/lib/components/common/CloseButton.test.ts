import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import CloseButton from "$lib/components/common/buttons/CloseButton/CloseButton.svelte";

describe("CloseButton", () => {
	it("provides a consistent accessible close action", async () => {
		const onclick = vi.fn();
		render(CloseButton, {
			props: {
				label: "Close scanner",
				onclick,
			},
		});

		const button = screen.getByRole("button", { name: "Close scanner" });
		expect(button).toHaveAttribute("title", "Close scanner");

		await fireEvent.click(button);
		expect(onclick).toHaveBeenCalledOnce();
	});
});
