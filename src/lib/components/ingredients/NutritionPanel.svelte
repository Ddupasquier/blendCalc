<script lang="ts">
	import MoveItemPrompt from "$lib/components/ingredients/MoveItemPrompt.svelte";
	import NutritionConfidenceDetails from "$lib/components/ingredients/NutritionConfidenceDetails.svelte";
	import CustomBadge from "$lib/components/common/CustomBadge.svelte";
	import type { FdcFood } from "$lib/utils/food/types";
	import { getFoodQuality } from "$lib/utils/food/foodQuality";
	import {
		addFoodToSmoothieList,
		readSmoothieList,
		removeFoodFromSmoothieList,
	} from "$lib/utils/storage/smoothieLists";
	import {
		getFdcNutrientValue,
		isFdcNutrientMatch,
	} from "$lib/utils/food/fdcNutrients";
	import { onDestroy, onMount } from "svelte";
	import { MIX_STORAGE_KEYS } from "../../../defaults/mixDefaults";

	interface Props {
		food?: FdcFood;
	}

	let { food }: Props = $props();

	import { vitalNutrients } from "../../../variables/vitalNutrients";

	const foodQuality = $derived(food ? getFoodQuality(food) : null);
	const vitalRows = $derived(
		food
			? vitalNutrients.map((vn) => {
					const value = getFdcNutrientValue(food, Number(vn.id));
					return {
						label: vn.label,
						value: value ? value.toFixed(1) : "0",
						unit: vn.unit,
						highlight: vn.highlight || false,
					};
				})
			: [],
	);

	const vitalIds = vitalNutrients.map((vn) => Number(vn.id));
	const extraRows = $derived(
		food
			? food.foodNutrients
					.filter(
						(n) =>
							!vitalIds.some((id) => isFdcNutrientMatch(n, id)) &&
							n.value !== 0,
					)
					.map((n) => ({
						label: n.nutrientName,
						value:
							n.value % 1 === 0
								? Math.round(n.value)
								: n.value.toFixed(2),
						unit: n.unitName,
					}))
			: [],
	);

	// Height sync logic
	let vitalListRef: HTMLUListElement | null = null;
	let rightColHeight = $state(0);

	const syncHeight = () => {
		if (vitalListRef) {
			rightColHeight = vitalListRef.offsetHeight;
		}
	};

	$effect(() => {
		syncHeight();
	});

	onMount(() => {
		syncHeight();
		window.addEventListener("resize", syncHeight);
		return () => window.removeEventListener("resize", syncHeight);
	});

	// Move prompt state
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
		from: typeof MIX_STORAGE_KEYS.fridge | typeof MIX_STORAGE_KEYS.shoppingList,
		to: typeof MIX_STORAGE_KEYS.fridge | typeof MIX_STORAGE_KEYS.shoppingList,
		successMessage: string,
	) => {
		if (!food || pendingAction) return;
		pendingAction = "move";
		try {
			const addResult = await addFoodToSmoothieList(to, food);
			if (addResult === "error") {
				showFeedback("The item could not be moved. Try again.", true);
				return;
			}

			const removeResult = await removeFoodFromSmoothieList(from, food.fdcId);
			if (removeResult === "error") {
				showFeedback(
					"Added to the new list, but the old copy could not be removed.",
					true,
				);
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
		const shoppingList = readSmoothieList(MIX_STORAGE_KEYS.shoppingList);
		if (shoppingList.some((item) => item.fdcId === food.fdcId)) {
			movePrompt = {
				message:
					"This item is already in your shopping list. Move it to your fridge?",
				onConfirm: () =>
					void moveFood(
						MIX_STORAGE_KEYS.shoppingList,
						MIX_STORAGE_KEYS.fridge,
						"Moved to fridge.",
					),
				onCancel: () => {
					movePrompt = null;
				},
			};
			return;
		}
		if (pendingAction) return;
		pendingAction = "fridge";
		try {
			const result = await addFoodToSmoothieList(MIX_STORAGE_KEYS.fridge, food);
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
		const fridgeList = readSmoothieList(MIX_STORAGE_KEYS.fridge);
		if (fridgeList.some((item) => item.fdcId === food.fdcId)) {
			movePrompt = {
				message:
					"This item is already in your fridge. Move it to your shopping list?",
				onConfirm: () =>
					void moveFood(
						MIX_STORAGE_KEYS.fridge,
						MIX_STORAGE_KEYS.shoppingList,
						"Moved to shopping list.",
					),
				onCancel: () => {
					movePrompt = null;
				},
			};
			return;
		}
		if (pendingAction) return;
		pendingAction = "shopping";
		try {
			const result = await addFoodToSmoothieList(
				MIX_STORAGE_KEYS.shoppingList,
				food,
			);
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

<section class="nf-label">
	<div class="nf-heading">
		<div class="nf-title">Nutrition Facts</div>
		<div class="nf-basis">Per 100g food data</div>
	</div>
	{#if food?.description}
		<div class="nf-food-row">
			<div class="nf-food">{food.description}</div>
			{#if food.customFood}
				<CustomBadge />
			{/if}
		</div>
	{/if}
	{#if foodQuality && (foodQuality.label === "Partial" || foodQuality.label === "Limited")}
		<NutritionConfidenceDetails quality={foodQuality} />
	{/if}
	<div class="nf-thick-divider"></div>
	<div class="nf-columns">
		<ul class="nf-list vital-list" bind:this={vitalListRef}>
			{#each vitalRows as row, i}
				<li class="nf-row {row.highlight ? 'nf-highlight' : ''}">
					<span
						class="nf-label-text {i === 0
							? 'nf-calories-label'
							: ''}">{row.label}</span
					>
					<span class="nf-value {i === 0 ? 'nf-calories-value' : ''}"
						>{row.value}
						<span class="nf-unit">{row.unit}</span></span
					>
				</li>
				{#if i === 0}
					<div class="nf-thick-divider"></div>
				{/if}
				{#if i === vitalRows.length - 2}
					<div class="nf-divider"></div>
				{/if}
			{/each}
		</ul>
		<div class="nf-scroll-wrap" style="max-height: {rightColHeight}px;">
			<ul class="nf-list extra-list">
				{#each extraRows as row}
					<li class="nf-row nf-extra">
						<span class="nf-label-text">{row.label}</span>
						<span class="nf-value"
							>{row.value}
							<span class="nf-unit">{row.unit}</span></span
						>
					</li>
				{/each}
			</ul>
		</div>
	</div>

	<div class="nf-actions">
		<button class="nf-btn" onclick={handleAddToFridge} disabled={!food || pendingAction !== null}
			>{pendingAction === "fridge" ? "Adding…" : "Add to Fridge"}</button
		>
		<button class="nf-btn" onclick={handleAddToShopping} disabled={!food || pendingAction !== null}
			>{pendingAction === "shopping" ? "Adding…" : "Add to Shopping List"}</button
		>
	</div>
	{#if feedbackMessage}
		<div class="nf-feedback" class:nf-feedback--error={feedbackError} role={feedbackError ? "alert" : "status"} aria-live="polite">
			<span>{feedbackError ? "!" : "✓"}</span>
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
</section>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.nf-label {
		width: 100%;
		max-width: 100%;
		background: $nutrition-label-bg;
		border: $app-border-strong;
		border-radius: 0;
		margin: 0 auto;
		font-family: $app-font-family-data;
		color: $nutrition-label-text;
		padding: 0.7rem 1.1rem 1.1rem 1.1rem;
		overflow: hidden;
	}
	.nf-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		border-bottom: $app-border-highlight;
		padding-bottom: 0.18rem;
		margin-bottom: 0.1rem;
	}
	.nf-title {
		font-size: 2.1rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.01em;
		line-height: 1.1;
	}
	.nf-basis {
		max-width: 6.8rem;
		padding-top: 0.18rem;
		color: $nutrition-label-muted;
		font-size: 0.68rem;
		font-weight: 800;
		line-height: 1.15;
		text-align: right;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}
	.nf-food-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-bottom: 0.2rem;
	}
	.nf-food {
		min-width: 0;
		font-size: 1.01rem;
		font-weight: 600;
		color: $nutrition-label-muted;
		overflow-wrap: anywhere;
	}
	.nf-thick-divider {
		border-bottom: $app-border-thick;
		margin: 0.2rem 0 0.3rem 0;
	}
	.nf-divider {
		border-bottom: $app-border-divider;
		margin: 0.1rem 0 0.1rem 0;
	}
	.nf-columns {
		display: flex;
		flex-direction: row;
		gap: 1.1rem;
		align-items: stretch;
		margin-bottom: 0.2rem;
		min-height: 120px;
		min-width: 0;
	}
	.vital-list {
		flex: 0 0 220px;
		margin: 0;
		padding: 0;
		padding-right: 1.1rem;
		min-width: 180px;
		max-width: 220px;
	}
	.nf-scroll-wrap {
		flex: 1 1 0;
		min-width: 0;
		padding-left: 1.1rem;
		overflow-y: auto;
		overflow-x: hidden;
		max-height: 100%;
		border-left: $app-border-strong;
		display: flex;
		align-items: stretch;
	}
	.nf-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.nf-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.45rem;
		padding: 0.13rem 0.1rem 0.13rem 0.1rem;
		font-size: 1.01rem;
		font-weight: 600;
		background: none;
		color: $nutrition-label-text;
	}
	.nf-highlight {
		font-size: 1.18rem;
		font-weight: 900;
	}
	.nf-label-text {
		min-width: 0;
		color: $nutrition-label-text;
		font-weight: 700;
		letter-spacing: 0.01em;
		font-size: 1.01rem;
		text-transform: uppercase;
		overflow-wrap: anywhere;
	}
	.nf-calories-label {
		font-size: 1.18rem;
		font-weight: 900;
	}
	.nf-value {
		flex: 0 0 auto;
		font-weight: 900;
		color: $nutrition-label-text;
		font-size: 1.01rem;
	}
	.nf-calories-value {
		font-size: 1.18rem;
		font-weight: 900;
	}
	.nf-unit {
		font-weight: 400;
		color: $nutrition-label-muted;
		font-size: 0.82em;
		margin-left: 0.13em;
		text-transform: uppercase;
	}
	.nf-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.7rem;
		margin: 0.7rem 0 0.2rem 0;
	}
	.nf-feedback {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.35rem;
		min-height: 1.3rem;
		margin: 0.2rem 0;
		color: $app-primary;
		font-family: $app-font-family-data;
		font-size: 0.86rem;
		font-weight: 800;
		animation: nf-feedback-pop 0.18s ease-out;

		span {
			display: inline-grid;
			place-items: center;
			width: 1.05rem;
			height: 1.05rem;
			color: $app-primary;
			background: $app-success-bg;
			border-radius: $app-radius-pill;
			font-size: 0.72rem;
			line-height: 1;
		}
	}
	.nf-btn {
		background: $nutrition-label-muted;
		color: $nutrition-label-bg;
		border: none;
		border-radius: $nutrition-label-button-radius;
		font-size: 1rem;
		font-family: $app-button-font-family;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
		padding: 0.45em 1.1em;
		cursor: pointer;
		transition: background 0.15s;

		&:disabled {
			background: $nutrition-label-disabled;
			cursor: not-allowed;
		}
		&:not(:disabled):hover {
			background: $nutrition-label-hover;
		}
	}

	@media (max-width: $app-breakpoint-xs) {
		.nf-label {
			padding: 0.65rem 0.85rem 0.95rem;
		}

		.nf-heading {
			gap: 0.5rem;
		}

		.nf-title {
			font-size: clamp(1.75rem, 10vw, 2.1rem);
		}

		.nf-basis {
			max-width: 5.5rem;
			font-size: 0.58rem;
		}

		.nf-columns {
			display: grid;
			grid-template-columns: 1fr;
			gap: 0.55rem;
			min-height: 0;
		}

		.vital-list {
			flex: none;
			width: 100%;
			min-width: 0;
			max-width: none;
			padding-right: 0;
		}

		.nf-scroll-wrap {
			width: 100%;
			max-height: 9.5rem !important;
			padding-top: 0.55rem;
			padding-left: 0;
			border-top: $app-border-strong;
			border-left: 0;
		}

		.nf-row {
			font-size: 0.92rem;
		}

		.nf-label-text,
		.nf-value {
			font-size: 0.92rem;
		}

		.nf-highlight,
		.nf-calories-label,
		.nf-calories-value {
			font-size: 1.05rem;
		}

		.nf-actions {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.55rem;
		}

		.nf-btn {
			width: 100%;
			min-width: 0;
			padding: 0.5rem 0.45rem;
			font-size: 0.9rem;
			line-height: 1.15;
		}
	}

	@keyframes nf-feedback-pop {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
