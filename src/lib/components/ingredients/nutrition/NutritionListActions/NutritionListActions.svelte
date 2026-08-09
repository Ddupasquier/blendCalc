<script lang="ts">
	import { onDestroy } from "svelte";
	import { fly } from "svelte/transition";
	import Check from "$lib/assets/icons/Check/Check.svelte";
	import X from "$lib/assets/icons/X/X.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import MoveItemPrompt from "$lib/components/ingredients/nutrition/MoveItemPrompt/MoveItemPrompt.svelte";
	import type { NutritionListActionsProps } from "./types";
	import {
		getIngredientMembershipLabel,
	} from "$lib/utils/ingredients/ingredientListUi";
	import {
		addFoodToIngredientList,
		moveFoodToIngredientList,
	} from "$lib/utils/storage/client/ingredientLists";
	import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
	import { getFeedbackFlyTransition } from "$lib/utils/animation/transitions";

	let {
		food,
		showListActions = true,
		listMembership = { inFridge: false, inShoppingList: false },
	}: NutritionListActionsProps = $props();

	const membershipLabel = $derived(getIngredientMembershipLabel(listMembership));
	const isAlreadySaved = $derived(Boolean(membershipLabel));

	let movePrompt = $state<null | {
		message: string;
		onConfirm: () => void;
		onCancel: () => void;
	}>(null);
	let feedbackMessage = $state("");
	let feedbackError = $state(false);
	let pendingAction = $state<"fridge" | "shopping" | "move" | null>(null);
	let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

	const showFeedback = (message: string, isError = false) => {
		feedbackMessage = message;
		feedbackError = isError;
		if (feedbackTimer) clearTimeout(feedbackTimer);
		feedbackTimer = setTimeout(() => {
			feedbackMessage = "";
			feedbackTimer = null;
		}, 1800);
	};

	onDestroy(() => {
		if (feedbackTimer) clearTimeout(feedbackTimer);
	});

	const moveFood = async (
		to: typeof MIX_STORAGE_KEYS.fridge | typeof MIX_STORAGE_KEYS.shoppingList,
		successMessage: string,
	) => {
		if (!food || pendingAction) return;
		pendingAction = "move";
		try {
			const moveResult = await moveFoodToIngredientList(to, food);
			if (moveResult === "error") {
				showFeedback("The item could not be moved. Try again.", true);
				return;
			}
			showFeedback(successMessage);
			movePrompt = null;
		} finally {
			pendingAction = null;
		}
	};

	const handleAddToFridge = async () => {
		if (!food) return;
		if (pendingAction) return;
		pendingAction = "fridge";
		try {
			const result = await addFoodToIngredientList(MIX_STORAGE_KEYS.fridge, food);
			if (result === "move-required:shopping") {
				movePrompt = {
					message:
						"This item is already in your shopping list. Move it to your fridge?",
					onConfirm: () =>
						void moveFood(
							MIX_STORAGE_KEYS.fridge,
							"Moved to fridge.",
						),
					onCancel: () => {
						movePrompt = null;
					},
				};
				return;
			}
			showFeedback(
				result === "added"
					? "Added to fridge."
					: result === "duplicate"
						? "Already in fridge."
						: "Could not add to fridge. Try again.",
				result === "error",
			);
		} finally {
			pendingAction = null;
		}
	};

	const handleAddToShopping = async () => {
		if (!food) return;
		if (pendingAction) return;
		pendingAction = "shopping";
		try {
			const result = await addFoodToIngredientList(
				MIX_STORAGE_KEYS.shoppingList,
				food,
			);
			if (result === "move-required:fridge") {
				movePrompt = {
					message:
						"This item is already in your fridge. Move it to your shopping list?",
					onConfirm: () =>
						void moveFood(
							MIX_STORAGE_KEYS.shoppingList,
							"Moved to shopping list.",
						),
					onCancel: () => {
						movePrompt = null;
					},
				};
				return;
			}
			showFeedback(
				result === "added"
					? "Added to shopping list."
					: result === "duplicate"
						? "Already in shopping list."
						: "Could not add to shopping list. Try again.",
				result === "error",
			);
		} finally {
			pendingAction = null;
		}
	};
</script>

{#if showListActions && isAlreadySaved}
	<p class="nf-list-status" role="status">
		<Check size={15} strokeWidth={2.8} />
		{membershipLabel}
	</p>
{:else if showListActions}
	<div class="nf-actions">
		<RoundedActionButton
			fullWidth
			variant="primary"
			busy={pendingAction === "fridge"}
			disabled={!food || pendingAction !== null}
			onclick={handleAddToFridge}
		>
			Add to Fridge
		</RoundedActionButton>
		<RoundedActionButton
			fullWidth
			variant="outline"
			busy={pendingAction === "shopping"}
			disabled={!food || pendingAction !== null}
			onclick={handleAddToShopping}
		>
			Shopping List
		</RoundedActionButton>
	</div>
{/if}

{#if feedbackMessage}
	<div
		class="nf-feedback"
		class:nf-feedback--error={feedbackError}
		role={feedbackError ? "alert" : "status"}
		aria-live="polite"
		transition:fly={getFeedbackFlyTransition()}
	>
		<CircularIconFrame class="nf-feedback__icon" decorative>
			{#if feedbackError}
				<X size={14} strokeWidth={2.8} />
			{:else}
				<Check size={14} strokeWidth={2.8} />
			{/if}
		</CircularIconFrame>
		{feedbackMessage}
	</div>
{/if}

{#if movePrompt}
	<MoveItemPrompt
		message={movePrompt.message}
		busy={pendingAction === "move"}
		onConfirm={movePrompt.onConfirm}
		onCancel={movePrompt.onCancel}
	/>
{/if}

<style lang="scss">
	@use "./NutritionListActions.scss";
</style>
