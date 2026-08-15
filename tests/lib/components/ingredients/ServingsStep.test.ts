import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ServingsStep from "$lib/components/ingredients/manual-entry/steps/ServingsStep/ServingsStep.svelte";

describe("ServingsStep", () => {
	it("uses weight and optional volume without a duplicate label input", () => {
		render(ServingsStep, {
			props: {
				servingWeightGrams: 30,
				usesInternal100GramBasis: false,
				requiresServingWeight: true,
				useVolumeEquivalent: false,
				volumeQuantity: null,
				volumeUnit: "tbsp",
				volumeOptions: [{ value: "tbsp", label: "tablespoons (tbsp)" }],
				regulatoryDisclosureProfiles: [],
				regulatoryDisclosureProfileError: "",
				regulatoryDisclosureProfileKey: "",
				alcoholByVolumePercent: null,
				requiresAlcoholByVolume: false,
				onServingWeightChange: vi.fn(),
				onUseVolumeChange: vi.fn(),
				onVolumeQuantityChange: vi.fn(),
				onVolumeUnitChange: vi.fn(),
				onRegulatoryDisclosureChange: vi.fn(),
				onAlcoholByVolumeChange: vi.fn(),
				onBack: vi.fn(),
				onNext: vi.fn(),
			},
		});

		expect(screen.getByLabelText("Weight (g) *")).toBeInTheDocument();
		expect(screen.getByRole("switch", { name: "Label includes volume" }))
			.toBeInTheDocument();
		expect(screen.queryByText("Display label")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Serving label")).not.toBeInTheDocument();
	});
});
