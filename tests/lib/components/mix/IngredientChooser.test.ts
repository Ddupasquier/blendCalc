import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import IngredientChooser from "$lib/components/mix/ingredients/IngredientChooser/IngredientChooser.svelte";
import type { FdcFood } from "$lib/utils/food/types";

const food = (values: Partial<FdcFood>): FdcFood => ({
	fdcId: 1,
	description: "Test ingredient",
	foodNutrients: [],
	...values,
});

const renderChooser = () =>
	render(IngredientChooser, {
		props: {
			fridgeItems: [
				food({
					fdcId: 1,
					description: "Catalog Jelly",
					customFood: true,
					sourceKey: "usda",
					sharedProductId: "catalog-product-id",
					trustStatus: "source-verified",
				}),
				food({
					fdcId: 2,
					description: "Purple Homebrew",
					customFood: true,
					sourceKey: "custom",
					barcodeSource: "manual",
				}),
			],
			shoppingItems: [
				food({
					fdcId: 3,
					description: "Pending Pantry Product",
					customFood: true,
					sourceKey: "unknown",
					sharedProductSubmissionId: "pending-submission-id",
					trustStatus: "pending-review",
				}),
			],
			selectedFoodIds: [],
			onOpenRename: vi.fn(),
			onCloseRename: vi.fn(),
			onToggleFood: vi.fn(),
		},
	});

describe("IngredientChooser custom filtering", () => {
	it("keeps catalog and pending foods out of Custom only", async () => {
		renderChooser();

		expect(screen.getByText("Catalog Jelly")).toBeInTheDocument();
		expect(screen.getByText("Purple Homebrew")).toBeInTheDocument();
		expect(screen.getByText("Pending Pantry Product")).toBeInTheDocument();

		await fireEvent.change(screen.getByLabelText("Show"), {
			target: { value: "custom" },
		});

		const fridge = screen.getByLabelText("Mix fridge ingredients");
		expect(within(fridge).getByText("Purple Homebrew")).toBeInTheDocument();
		expect(within(fridge).getByText("Custom")).toBeInTheDocument();
		expect(screen.queryByText("Catalog Jelly")).not.toBeInTheDocument();
		expect(screen.queryByText("Pending Pantry Product")).not.toBeInTheDocument();
		expect(screen.getByText("1 of 3 ingredients")).toBeInTheDocument();
	});
});
