import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import SavedIngredientList from "$lib/components/ingredients/list/SavedIngredientList/SavedIngredientList.svelte";
import type { FdcFood } from "$lib/utils/food/types";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

const food: FdcFood = {
	fdcId: 1,
	description: "Spinach, raw",
	foodCategory: "Vegetables",
	foodNutrients: [],
};

const secondFood: FdcFood = {
	fdcId: 2,
	description: "Tomato, roma",
	foodCategory: "Vegetables",
	foodNutrients: [],
};

const sempioGochuJang: FdcFood = {
	fdcId: 3,
	description: "Sempio, Gochu Jang Hot & Sweet Chili Sauce",
	brandOwner: "Sempio",
	foodCategory: "Dips and Salsa",
	foodNutrients: [],
	image: {
		source: "open-food-facts",
		role: "front",
		imageUrl: "https://images.example.com/sempio-gochu-jang.jpg",
		licenseName: "CC BY-SA",
		confidence: "source-verified",
	},
};

describe("SavedIngredientList overlay behavior", () => {
	const renderList = (
		activeList: SmoothieListKey = MIX_STORAGE_KEYS.fridge,
		canRevealMore = false,
	) =>
		render(SavedIngredientList, {
			props: {
				activeList,
				foods: [food],
				canRevealMore,
				onSelectAll: vi.fn(),
				onEnterSelection: vi.fn(),
				onCancelSelection: vi.fn(),
				onMoveSelection: vi.fn(),
				onMoveItem: vi.fn(),
				onToggle: vi.fn(),
				onPreview: vi.fn(),
				onActions: vi.fn(),
				onRemove: vi.fn(),
				onRevealMore: vi.fn(),
			},
		});

	it("does not auto-load on scroll and disables loading while an overlay is open", async () => {
		const onRevealMore = vi.fn();

		render(SavedIngredientList, {
			props: {
				activeList: MIX_STORAGE_KEYS.fridge,
				foods: [food],
				canRevealMore: true,
				revealPaused: true,
				onSelectAll: vi.fn(),
				onEnterSelection: vi.fn(),
				onCancelSelection: vi.fn(),
				onMoveSelection: vi.fn(),
				onMoveItem: vi.fn(),
				onToggle: vi.fn(),
				onPreview: vi.fn(),
				onActions: vi.fn(),
				onRemove: vi.fn(),
				onRevealMore,
			},
		});

		const list = screen.getByRole("list", { name: "Fridge ingredients" });
		Object.defineProperties(list, {
			scrollHeight: { configurable: true, value: 500 },
			scrollTop: { configurable: true, value: 400 },
			clientHeight: { configurable: true, value: 100 },
		});

		await fireEvent.scroll(list);

		expect(onRevealMore).not.toHaveBeenCalled();
		expect(
			screen.getByRole("button", { name: "Load more" }),
		).toBeDisabled();
	});

	it("keeps selection state out of normal cards and provides a visible entry action", async () => {
		const onEnterSelection = vi.fn();
		render(SavedIngredientList, {
			props: {
				activeList: MIX_STORAGE_KEYS.fridge,
				foods: [food],
				onSelectAll: vi.fn(),
				onEnterSelection,
				onCancelSelection: vi.fn(),
				onMoveSelection: vi.fn(),
				onMoveItem: vi.fn(),
				onToggle: vi.fn(),
				onPreview: vi.fn(),
				onActions: vi.fn(),
				onRemove: vi.fn(),
				onRevealMore: vi.fn(),
			},
		});

		expect(
			screen.queryByRole("button", { name: "Select Spinach, raw" }),
		).not.toBeInTheDocument();
		await fireEvent.click(screen.getByRole("button", { name: "Select items" }));
		expect(onEnterSelection).toHaveBeenCalledWith();
	});

	it.each([
		["Fridge", MIX_STORAGE_KEYS.fridge],
		["Shopping List", MIX_STORAGE_KEYS.shoppingList],
	] as const)(
		"uses full-height product images across %s cards",
		(_, activeList) => {
		const { container } = render(SavedIngredientList, {
			props: {
				activeList,
				foods: [food, sempioGochuJang],
				onSelectAll: vi.fn(),
				onEnterSelection: vi.fn(),
				onCancelSelection: vi.fn(),
				onMoveSelection: vi.fn(),
				onMoveItem: vi.fn(),
				onToggle: vi.fn(),
				onPreview: vi.fn(),
				onActions: vi.fn(),
				onRemove: vi.fn(),
				onRevealMore: vi.fn(),
			},
		});

		expect(
			container.querySelector(
				".saved-ingredient-card > .ingredient-card-feature-image img",
			),
		).toHaveAttribute(
			"src",
			"https://images.example.com/sempio-gochu-jang.jpg",
		);
		expect(
			screen.getAllByRole("button", {
				name: "Preview Sempio, Gochu Jang Hot & Sweet Chili Sauce",
			}),
		).toHaveLength(1);
		},
	);

	it("uses the full-height media lane for a category symbol without a product image", () => {
		const { container } = render(SavedIngredientList, {
			props: {
				activeList: MIX_STORAGE_KEYS.fridge,
				foods: [food],
				onSelectAll: vi.fn(),
				onEnterSelection: vi.fn(),
				onCancelSelection: vi.fn(),
				onMoveSelection: vi.fn(),
				onMoveItem: vi.fn(),
				onToggle: vi.fn(),
				onPreview: vi.fn(),
				onActions: vi.fn(),
				onRemove: vi.fn(),
				onRevealMore: vi.fn(),
			},
		});

		expect(
			container.querySelector(".ingredient-card-feature-image"),
		).toBeInTheDocument();
		expect(
			container.querySelector(
				".ingredient-card-feature-media__fallback .food-symbol__fallback",
			),
		).toBeInTheDocument();
		expect(container.querySelector(".circular-media-frame")).not.toBeInTheDocument();
	});

	it("keeps the full-height media lane when a product image fails", async () => {
		const { container } = render(SavedIngredientList, {
			props: {
				activeList: MIX_STORAGE_KEYS.fridge,
				foods: [sempioGochuJang],
				onSelectAll: vi.fn(),
				onEnterSelection: vi.fn(),
				onCancelSelection: vi.fn(),
				onMoveSelection: vi.fn(),
				onMoveItem: vi.fn(),
				onToggle: vi.fn(),
				onPreview: vi.fn(),
				onActions: vi.fn(),
				onRemove: vi.fn(),
				onRevealMore: vi.fn(),
			},
		});

		const image = container.querySelector<HTMLImageElement>(
			".ingredient-card-feature-image img",
		);
		expect(image).not.toBeNull();
		await fireEvent.error(image as HTMLImageElement);

		expect(
			container.querySelector(".ingredient-card-feature-image"),
		).toBeInTheDocument();
		expect(
			container.querySelector(
				".ingredient-card-feature-media__fallback .food-symbol__fallback",
			),
		).toBeInTheDocument();
		expect(container.querySelector(".circular-media-frame")).not.toBeInTheDocument();
	});

	it("keeps the warning edge above cards with feature images", () => {
		const warningFood: FdcFood = {
			...sempioGochuJang,
			preferenceWarnings: [{
				id: "allergen-warning",
				level: "warning",
				category: "allergen",
				label: "Soy",
				reason: "Soy conflict: this product contains soy.",
			}],
		};
		const { container } = render(SavedIngredientList, {
			props: {
				activeList: MIX_STORAGE_KEYS.fridge,
				foods: [warningFood],
				onSelectAll: vi.fn(),
				onEnterSelection: vi.fn(),
				onCancelSelection: vi.fn(),
				onMoveSelection: vi.fn(),
				onMoveItem: vi.fn(),
				onToggle: vi.fn(),
				onPreview: vi.fn(),
				onActions: vi.fn(),
				onRemove: vi.fn(),
				onRevealMore: vi.fn(),
			},
		});

		const card = container.querySelector(".saved-ingredient-card");
		const image = card?.querySelector(".ingredient-card-feature-image");
		const warningEdge = card?.querySelector(".card-warning-edge");
		expect(image).toBeInTheDocument();
		expect(warningEdge).toBeInTheDocument();
		if (!image || !warningEdge) {
			throw new Error("Expected both the feature image and warning edge.");
		}
		expect(
			image.compareDocumentPosition(warningEdge) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(
			screen.getByRole("button", {
				name: /Warning: Soy conflict/,
			}),
		).toBeInTheDocument();
	});

	it("announces selection mode and the selected count", () => {
		render(SavedIngredientList, {
			props: {
				activeList: MIX_STORAGE_KEYS.fridge,
				foods: [food, secondFood],
				selectionMode: true,
				selectedIds: [food.fdcId],
				onSelectAll: vi.fn(),
				onEnterSelection: vi.fn(),
				onCancelSelection: vi.fn(),
				onMoveSelection: vi.fn(),
				onMoveItem: vi.fn(),
				onToggle: vi.fn(),
				onPreview: vi.fn(),
				onActions: vi.fn(),
				onRemove: vi.fn(),
				onRevealMore: vi.fn(),
			},
		});

		expect(screen.getByRole("status")).toHaveTextContent(
			"Selection mode. 1 ingredient selected.",
		);
		expect(
			screen.getByRole("button", { name: "Unselect Spinach, raw" }),
		).toHaveAttribute("aria-pressed", "true");
		expect(
			screen.getByRole("button", { name: "Select Tomato, roma" }),
		).toHaveAttribute("aria-pressed", "false");
	});

	it("requires two deliberate activations before removing an ingredient", async () => {
		const onRemove = vi.fn();

		render(SavedIngredientList, {
			props: {
				activeList: MIX_STORAGE_KEYS.fridge,
				foods: [food],
				onSelectAll: vi.fn(),
				onEnterSelection: vi.fn(),
				onCancelSelection: vi.fn(),
				onMoveSelection: vi.fn(),
				onMoveItem: vi.fn(),
				onToggle: vi.fn(),
				onPreview: vi.fn(),
				onActions: vi.fn(),
				onRemove,
				onRevealMore: vi.fn(),
			},
		});

		await fireEvent.click(
			screen.getByRole("button", { name: "Remove Spinach, raw" }),
		);

		expect(onRemove).not.toHaveBeenCalled();
		expect(
			screen.getByText("Tap or click delete again to confirm."),
		).toBeVisible();

		await fireEvent.click(
			screen.getByRole("button", {
				name: "Confirm deletion of Spinach, raw",
			}),
		);

		expect(onRemove).toHaveBeenCalledOnce();
		expect(onRemove).toHaveBeenCalledWith(1);
		expect(
			screen.queryByText("Tap or click delete again to confirm."),
		).not.toBeInTheDocument();
	});

	it("shows a return-to-top control only for an overflowing completed list", async () => {
		renderList();
		const list = screen.getByRole("list", { name: "Fridge ingredients" });
		const scrollTo = vi.fn();

		Object.defineProperties(list, {
			scrollHeight: { configurable: true, value: 500 },
			clientHeight: { configurable: true, value: 100 },
			scrollTo: { configurable: true, value: scrollTo },
		});

		await fireEvent(window, new Event("resize"));
		const returnButton = await screen.findByRole("button", {
			name: "Return to top",
		});
		await fireEvent.click(returnButton);

		expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
	});

	it("does not show a return-to-top control when the list fits", async () => {
		renderList(MIX_STORAGE_KEYS.shoppingList);
		const list = screen.getByRole("list", {
			name: "Shopping List ingredients",
		});

		Object.defineProperties(list, {
			scrollHeight: { configurable: true, value: 100 },
			clientHeight: { configurable: true, value: 100 },
		});

		await fireEvent(window, new Event("resize"));

		expect(
			screen.queryByRole("button", { name: "Return to top" }),
		).not.toBeInTheDocument();
	});

	it("shows both explicit controls without auto-loading an overflowing partial list", async () => {
		const onRevealMore = vi.fn();
		render(SavedIngredientList, {
			props: {
				activeList: MIX_STORAGE_KEYS.fridge,
				foods: [food],
				canRevealMore: true,
				onSelectAll: vi.fn(),
				onEnterSelection: vi.fn(),
				onCancelSelection: vi.fn(),
				onMoveSelection: vi.fn(),
				onMoveItem: vi.fn(),
				onToggle: vi.fn(),
				onPreview: vi.fn(),
				onActions: vi.fn(),
				onRemove: vi.fn(),
				onRevealMore,
			},
		});
		const list = screen.getByRole("list", { name: "Fridge ingredients" });

		Object.defineProperties(list, {
			scrollHeight: { configurable: true, value: 500 },
			scrollTop: { configurable: true, value: 400 },
			clientHeight: { configurable: true, value: 100 },
		});

		await fireEvent.scroll(list);
		await fireEvent(window, new Event("resize"));

		expect(onRevealMore).not.toHaveBeenCalled();
		expect(
			screen.getByRole("button", { name: "Return to top" }),
		).toBeVisible();

		await fireEvent.click(screen.getByRole("button", { name: "Load more" }));
		expect(onRevealMore).toHaveBeenCalledOnce();
	});

	it.each([
		[
			"Fridge",
			MIX_STORAGE_KEYS.fridge,
			"Move to Shopping List: Spinach, raw",
			"110%",
		],
		[
			"Shopping List",
			MIX_STORAGE_KEYS.shoppingList,
			"Move to Fridge: Spinach, raw",
			"-110%",
		],
	] as const)(
		"animates one %s card in the destination direction before persisting",
		async (_, activeList, moveLabel, distance) => {
			const onMoveItem = vi.fn().mockResolvedValue(true);
			const cancel = vi.fn();
			let finishExit: (() => void) | undefined;
			const finished = new Promise<void>((resolve) => {
				finishExit = resolve;
			});
			const animate = vi.fn(
				(_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) =>
					({
						finished,
						cancel,
					}) as unknown as Animation,
			);
			const { container } = render(SavedIngredientList, {
				props: {
					activeList,
					foods: [food],
					onSelectAll: vi.fn(),
					onEnterSelection: vi.fn(),
					onCancelSelection: vi.fn(),
					onMoveSelection: vi.fn(),
					onMoveItem,
					onToggle: vi.fn(),
					onPreview: vi.fn(),
					onActions: vi.fn(),
					onRemove: vi.fn(),
					onRevealMore: vi.fn(),
				},
			});
			const card = container.querySelector<HTMLElement>(
				".saved-ingredient-card",
			);
			if (!card) throw new Error("Expected a saved ingredient card.");
			Object.defineProperty(card, "animate", {
				configurable: true,
				value: animate,
			});

			await fireEvent.click(screen.getByRole("button", { name: moveLabel }));

			await waitFor(() => expect(animate).toHaveBeenCalledOnce());
			expect(animate.mock.calls[0][0]).toEqual([
				{ opacity: 1, transform: "translate3d(0, 0, 0)" },
				{ opacity: 0, transform: `translate3d(${distance}, 0, 0)` },
			]);
			expect(onMoveItem).not.toHaveBeenCalled();

			finishExit?.();

			await waitFor(() => expect(onMoveItem).toHaveBeenCalledWith(food));
			await waitFor(() => expect(cancel).toHaveBeenCalledOnce());
		},
	);

	it("runs one bulk move after every selected card begins its exit", async () => {
		const onMoveSelection = vi.fn().mockResolvedValue(true);

		render(SavedIngredientList, {
			props: {
				activeList: MIX_STORAGE_KEYS.fridge,
				foods: [food, secondFood],
				selectionMode: true,
				selectedIds: [food.fdcId, secondFood.fdcId],
				onSelectAll: vi.fn(),
				onEnterSelection: vi.fn(),
				onCancelSelection: vi.fn(),
				onMoveSelection,
				onMoveItem: vi.fn(),
				onToggle: vi.fn(),
				onPreview: vi.fn(),
				onActions: vi.fn(),
				onRemove: vi.fn(),
				onRevealMore: vi.fn(),
			},
		});

		await fireEvent.click(
			screen.getByRole("button", {
				name: "Move 2 selected → Shopping List",
			}),
		);

		await waitFor(() => expect(onMoveSelection).toHaveBeenCalledOnce());
		expect(await screen.findByRole("status")).toHaveTextContent(
			"Moved 2 ingredients to Shopping List.",
		);
	});
});
