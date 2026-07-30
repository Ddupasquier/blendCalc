import { fireEvent, render, screen } from "@testing-library/svelte";
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
	it("enters selection mode after a deliberate hold", async () => {
		vi.useFakeTimers();
		const onEnterSelection = vi.fn();
		try {
			render(SavedIngredientCard, {
				props: { ...baseProps, onEnterSelection },
			});
			const preview = screen.getByRole("button", { name: "Preview Ground Beef" });

			await fireEvent.pointerDown(preview, {
				button: 0,
				isPrimary: true,
				pointerId: 1,
				pointerType: "touch",
			});
			vi.advanceTimersByTime(500);

			expect(onEnterSelection).toHaveBeenCalledOnce();
		} finally {
			vi.useRealTimers();
		}
	});

	it("uses card taps for selection and hides unrelated actions in selection mode", async () => {
		const onToggle = vi.fn();
		const { container } = render(SavedIngredientCard, {
			props: {
				...baseProps,
				selectionMode: true,
				onToggle,
			},
		});

		const cardTarget = screen.getByRole("button", {
			name: "Select Ground Beef",
		});
		const title = screen.getByText("Ground Beef");

		expect(title.closest("button")).toBeNull();
		expect(cardTarget).toHaveClass("saved-ingredient-card__select");
		expect(container.querySelector(".saved-ingredient-card__copy"))
			.toContainElement(title);

		await fireEvent.click(cardTarget);

		expect(onToggle).toHaveBeenCalledOnce();
		expect(
			screen.queryByRole("button", { name: "Move to Shopping List: Ground Beef" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Remove Ground Beef" }),
		).not.toBeInTheDocument();
	});

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
			container.querySelector(
				".ingredient-selection-indicator--selected svg",
			),
		).toBeInTheDocument();
		expect(container.querySelector(".saved-ingredient-card--checked"))
			.toBeInTheDocument();
		expect(screen.getAllByRole("button")).toHaveLength(1);
		expect(container.querySelector(".ingredient-bulk-toggle"))
			.not.toBeInTheDocument();
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
