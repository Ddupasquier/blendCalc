import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ServingsStep from "$lib/components/ingredients/manual-entry/steps/ServingsStep/ServingsStep.svelte";

describe("ServingsStep", () => {
	it("supports exact package weight, volume, and item measures", () => {
		render(ServingsStep, {
			props: {
				servingWeightGrams: 30,
				usesInternal100GramBasis: false,
				requiresServingMeasurement: true,
				useServingMeasure: false,
				servingLabel: "",
				servingMeasureQuantity: null,
				servingMeasureUnit: "tbsp",
				servingMeasureOptions: [
					{ value: "tbsp", label: "tablespoons (tbsp)" },
					{ value: "item", label: "items" },
				],
				regulatoryDisclosureProfiles: [],
				regulatoryDisclosureProfileError: "",
				regulatoryDisclosureProfileKey: "",
				alcoholByVolumePercent: null,
				requiresAlcoholByVolume: false,
				onServingWeightChange: vi.fn(),
				onServingLabelChange: vi.fn(),
				onUseServingMeasureChange: vi.fn(),
				onServingMeasureQuantityChange: vi.fn(),
				onServingMeasureUnitChange: vi.fn(),
				onRegulatoryDisclosureChange: vi.fn(),
				onAlcoholByVolumeChange: vi.fn(),
				onBack: vi.fn(),
				onNext: vi.fn(),
			},
		});

		expect(screen.getByLabelText("Weight (g) optional")).toBeInTheDocument();
		expect(
			screen.getByRole("switch", { name: "Package measure" }),
		).toBeInTheDocument();
		expect(screen.queryByLabelText("Serving label")).not.toBeInTheDocument();
	});
});
