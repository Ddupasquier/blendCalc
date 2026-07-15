import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import BarcodeScanButton from "$lib/components/ingredients/barcode/BarcodeScanButton.svelte";

describe("BarcodeScanButton", () => {
	it("keeps its static icon while a scan lookup is busy", () => {
		const { container } = render(BarcodeScanButton, {
			props: {
				scanning: true,
				compact: true,
				onclick: vi.fn(),
			},
		});

		const button = screen.getByRole("button", { name: "Scanning barcode" });
		expect(button).toBeDisabled();
		expect(button).toHaveAttribute("aria-busy", "true");
		expect(container.querySelector(".barcode-scanner--active")).toBeNull();
		expect(container.querySelector(".barcode-scanner__laser")).toBeNull();
	});
});
