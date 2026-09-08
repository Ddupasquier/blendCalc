import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ServingsStep from "$lib/components/ingredients/manual-entry/steps/ServingsStep/ServingsStep.svelte";

function createProps() {
	return {
		servingWeightGrams: 30,
		usesInternal100GramBasis: false,
		requiresServingMeasurement: true,
		useServingMeasure: false,
		servingLabel: "",
		servingMeasureQuantity: null,
		servingMeasureUnit: "tbsp" as const,
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
	};
}

describe("ServingsStep", () => {
	it("keeps the optional package measure collapsed until requested", async () => {
		const props = createProps();
		render(ServingsStep, { props });

		expect(
			screen.getByLabelText("Gram weight (g) optional"),
		).toBeInTheDocument();
		expect(
			screen.getByText("BlendCalc will save one serving as 30g."),
		).toHaveAttribute("aria-live", "polite");
		expect(
			screen.queryByLabelText("Package wording (optional)"),
		).not.toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("switch", { name: "Volume or item amount" }),
		);
		expect(props.onUseServingMeasureChange).toHaveBeenCalledWith(true);
	});

	it("does not repeat a gram weight already printed in the package wording", () => {
		render(ServingsStep, {
			props: {
				...createProps(),
				servingWeightGrams: 28,
				servingLabel: "1 oz (28 g)",
			},
		});

		expect(
			screen.getByText("BlendCalc will save one serving as 1 oz (28 g)."),
		).toBeInTheDocument();
		expect(screen.queryByText(/28 g\) \(28g\)/i)).not.toBeInTheDocument();
	});

	it("does not claim an exact measure for a unit missing from the available controls", () => {
		render(ServingsStep, {
			props: {
				...createProps(),
				servingWeightGrams: 28,
				useServingMeasure: true,
				servingLabel: "1 oz (28 g)",
				servingMeasureQuantity: 1,
				servingMeasureUnit: "oz",
			},
		});

		expect(
			screen.getByText("BlendCalc will save one serving as 1 oz (28 g)."),
		).toBeInTheDocument();
		expect(
			screen.queryByText(/with an exact measure/i),
		).not.toBeInTheDocument();
	});
});
