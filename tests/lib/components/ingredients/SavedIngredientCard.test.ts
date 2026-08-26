import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import SavedIngredientCard from "$lib/components/ingredients/list/SavedIngredientCard/SavedIngredientCard.svelte";
import { ingredientProvenanceOptionsFixture } from "../../../fixtures/referenceCatalogs";

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
	onEnterSelection: vi.fn(),
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

		expect(
			container.querySelector(".card-warning-edge"),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Preview Ground Beef" }),
		).toBeInTheDocument();
	});

	it("uses the danger edge for active official recalls", () => {
		const { container } = render(SavedIngredientCard, {
			props: {
				...baseProps,
				food: {
					...baseProps.food,
					safetyAlerts: [
						{
							id: "ea81b720-5e12-46a9-89cc-f6795aa68d08",
							providerKey: "open-fda-food-enforcement",
							sourceName: "FDA Food Safety Notices",
							sourceAttribution: "U.S. Food and Drug Administration",
							alertType: "recall" as const,
							status: "active",
							productDescription: "Recalled product",
							sourceUrl:
								"https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts",
							matchType: "exact_gtin" as const,
							requiresPackageCheck: false,
							detectedAt: "2026-08-14T12:00:00.000Z",
						},
					],
				},
				warning: "This product appears in an active official recall.",
			},
		});

		expect(container.querySelector(".card-warning-edge")).toHaveAttribute(
			"data-tone",
			"danger",
		);
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

describe("SavedIngredientCard action controls", () => {
	it("keeps card actions separate from the full-card primary target", async () => {
		const onPreview = vi.fn();
		const onMove = vi.fn();
		const onActions = vi.fn();
		render(SavedIngredientCard, {
			props: {
				...baseProps,
				onPreview,
				onMove,
				onActions,
			},
		});

		await fireEvent.click(
			screen.getByRole("button", {
				name: "Move to Shopping List: Ground Beef",
			}),
		);
		await fireEvent.click(
			screen.getByRole("button", { name: "Open actions for Ground Beef" }),
		);

		expect(onMove).toHaveBeenCalledOnce();
		expect(onActions).toHaveBeenCalledOnce();
		expect(onPreview).not.toHaveBeenCalled();
	});
});

describe("SavedIngredientCard selection mode", () => {
	it("uses one pressed card button and a non-color selected cue", () => {
		const { container } = render(SavedIngredientCard, {
			props: {
				...baseProps,
				selectionMode: true,
				checked: true,
			},
		});

		const selectionButton = screen.getByRole("button", {
			name: "Unselect Ground Beef",
		});

		expect(selectionButton).toHaveAttribute("aria-pressed", "true");
		expect(
			container.querySelector(".card-selection-indicator--selected svg"),
		).toBeInTheDocument();
		expect(
			container.querySelector(".saved-ingredient-card--checked"),
		).toBeInTheDocument();
		expect(screen.getAllByRole("button")).toHaveLength(1);
		expect(
			container.querySelector(".ingredient-bulk-toggle"),
		).not.toBeInTheDocument();
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

		expect(
			screen.queryByLabelText("Verification status: Verified"),
		).not.toBeInTheDocument();
	});

	it("styles only detached private foods as custom", () => {
		const { container, rerender } = render(SavedIngredientCard, {
			props: {
				...baseProps,
				food: {
					...baseProps.food,
					description: "Purple Homebrew",
					customFood: true,
					sourceKey: "custom",
				},
			},
		});

		expect(
			container.querySelector(".saved-ingredient-card--custom"),
		).toBeInTheDocument();

		rerender({
			...baseProps,
			food: {
				...baseProps.food,
				customFood: true,
				sourceKey: "usda",
				sharedProductId: "catalog-product-id",
				trustStatus: "source-verified",
			},
			provenanceOptions: ingredientProvenanceOptionsFixture,
		});

		expect(
			container.querySelector(".saved-ingredient-card--custom"),
		).not.toBeInTheDocument();
		expect(
			screen.queryByLabelText("Verification status: Verified"),
		).not.toBeInTheDocument();
	});

	it("shows pending review without restoring a stale custom treatment", () => {
		const { container } = render(SavedIngredientCard, {
			props: {
				...baseProps,
				food: {
					...baseProps.food,
					customFood: true,
					sourceKey: "unknown",
					sharedProductSubmissionId: "pending-submission-id",
					trustStatus: "pending-review",
				},
				provenanceOptions: ingredientProvenanceOptionsFixture,
			},
		});

		expect(
			container.querySelector(".saved-ingredient-card--custom"),
		).not.toBeInTheDocument();
		expect(
			screen.getByLabelText("Verification status: Pending"),
		).toBeInTheDocument();
	});

	it("removes pending metadata after rejection without adding a hierarchy badge", () => {
		const { container } = render(SavedIngredientCard, {
			props: {
				...baseProps,
				food: {
					...baseProps.food,
					customFood: false,
					sourceKey: "unknown",
					trustStatus: "unverified",
				},
				provenanceOptions: ingredientProvenanceOptionsFixture,
			},
		});

		expect(
			container.querySelector(".saved-ingredient-card--custom"),
		).not.toBeInTheDocument();
		expect(
			screen.queryByLabelText("Verification status: Pending"),
		).not.toBeInTheDocument();
		expect(
			screen.queryByLabelText("Verification status: Verified"),
		).not.toBeInTheDocument();
	});
});
