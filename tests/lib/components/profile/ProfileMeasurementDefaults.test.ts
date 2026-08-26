import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ProfileMeasurementDefaults from "$lib/components/profile/ProfileMeasurementDefaults/ProfileMeasurementDefaults.svelte";

describe("ProfileMeasurementDefaults", () => {
	it("separates display units from the exact Mix starting amount", () => {
		render(ProfileMeasurementDefaults, {
			props: {
				unitSystem: "metric",
				defaultServingSize: "28.349523125",
				defaultServingUnit: "g",
				disabled: false,
				onUnitSystemChange: vi.fn(),
				onDefaultServingSizeChange: vi.fn(),
				onDefaultServingUnitChange: vi.fn(),
				onRestoreDefaults: vi.fn(),
			},
		});

		expect(
			screen.getByRole("combobox", { name: "Display units" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("spinbutton", {
				name: "Default Mix starting amount",
			}),
		).toBeInTheDocument();
		expect(
			screen.getByText("28.3495 g = 1 oz · Exact unit conversion"),
		).toBeInTheDocument();
	});

	it("offers a scoped restore action", async () => {
		const onRestoreDefaults = vi.fn();
		render(ProfileMeasurementDefaults, {
			props: {
				unitSystem: "us",
				defaultServingSize: "2",
				defaultServingUnit: "oz",
				disabled: false,
				onUnitSystemChange: vi.fn(),
				onDefaultServingSizeChange: vi.fn(),
				onDefaultServingUnitChange: vi.fn(),
				onRestoreDefaults,
			},
		});

		await fireEvent.click(
			screen.getByRole("button", { name: "Restore measurement defaults" }),
		);
		expect(onRestoreDefaults).toHaveBeenCalledOnce();
	});
});
