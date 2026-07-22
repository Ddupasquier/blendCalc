import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import SavedIngredientCard from "$lib/components/ingredients/list/SavedIngredientCard/SavedIngredientCard.svelte";
import { ingredientProvenanceOptionsFixture } from "../../../fixtures/referenceData";

const baseProps = {
	food: {
		fdcId: 1,
		description: "Ground Beef",
		foodCategory: "Meat",
		foodNutrients: [],
	},
	moveDirection: "right" as const,
	moveLabel: "Move to Shopping List",
	category: "Meat",
	onToggle: vi.fn(),
	onPreview: vi.fn(),
	onMove: vi.fn(),
	onActions: vi.fn(),
	onRemove: vi.fn(),
};

describe("SavedIngredientCard warning treatment", () => {
	it("uses a card-edge warning bar without a visible warning icon", () => {
		const { container } = render(SavedIngredientCard, {
			props: {
				...baseProps,
				warning: "Peanut may be present",
			},
		});

		expect(container.querySelector(".card-warning-edge")).toBeInTheDocument();
		expect(
			screen.getByRole("button", {
				name: "Preview Ground Beef. Warning: Peanut may be present",
			}),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("img", {
				name: "Peanut may be present. Open ingredient for details.",
			}),
		).not.toBeInTheDocument();
	});

	it("does not change cards without warnings", () => {
		const { container } = render(SavedIngredientCard, {
			props: baseProps,
		});

		expect(container.querySelector(".card-warning-edge")).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Preview Ground Beef" }),
		).toBeInTheDocument();
	});
});

describe("SavedIngredientCard move action", () => {
	it("uses the focused move icon without changing shared chevrons", () => {
		const { container, rerender } = render(SavedIngredientCard, {
			props: baseProps,
		});

		expect(
			container.querySelector('.ingredient-move-icon[data-direction="left"]'),
		).toBeInTheDocument();

		rerender({ ...baseProps, moveDirection: "left" });

		expect(
			container.querySelector('.ingredient-move-icon[data-direction="right"]'),
		).toBeInTheDocument();
	});
});

describe("SavedIngredientCard verification metadata", () => {
	it("does not show resolved verification on the compact card", () => {
		render(SavedIngredientCard, {
			props: {
				...baseProps,
				food: {
					...baseProps.food,
					trustStatus: "source-verified",
				},
				provenanceOptions: ingredientProvenanceOptionsFixture,
			},
		});

		expect(screen.queryByLabelText("Verification status: Verified"))
			.not.toBeInTheDocument();
	});
});
