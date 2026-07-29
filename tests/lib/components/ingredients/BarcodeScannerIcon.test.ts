import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import BarcodeScannerIcon from "$lib/components/ingredients/barcode/BarcodeScannerIcon/BarcodeScannerIcon.svelte";

describe("BarcodeScannerIcon", () => {
	it("keeps both visual states mounted so activation can transition in either direction", async () => {
		const view = render(BarcodeScannerIcon, {
			props: {
				active: false,
			},
		});
		const scanner = view.container.querySelector(".barcode-scanner");
		const idleBars = view.container.querySelector(
			".barcode-scanner__idle-bars",
		);
		const activeBars = view.container.querySelector(".barcode-scanner__bars");

		expect(scanner).not.toHaveClass("barcode-scanner--active");
		expect(idleBars).toBeInTheDocument();
		expect(activeBars).toBeInTheDocument();

		await view.rerender({ active: true });

		expect(scanner).toHaveClass("barcode-scanner--active");
		expect(view.container.querySelector(".barcode-scanner__idle-bars")).toBe(
			idleBars,
		);
		expect(view.container.querySelector(".barcode-scanner__bars")).toBe(
			activeBars,
		);
	});
});
