import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import BarcodeScanButton from "$lib/components/ingredients/barcode/BarcodeScanButton/BarcodeScanButton.svelte";

describe("BarcodeScanButton", () => {
	it("uses the shared spinner while a scan lookup is busy", () => {
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
		expect(container.querySelector(".loading-spinner__ring")).toBeInTheDocument();
		expect(container.querySelector(".barcode-scanner")).toBeNull();
		expect(container.querySelector(".barcode-scanner--active")).toBeNull();
		expect(container.querySelector(".barcode-scanner__laser")).toBeNull();
	});
});
