<script lang="ts">
	import { MIX_STORAGE_KEYS } from "../../../defaults/mixDefaults";
	import type { FdcFood } from "$lib/utils/food/types";
	import type { SmoothieListKey } from "$lib/utils/storage/smoothieLists";

	export type CustomIngredientOutcomeState = {
		food: FdcFood;
		destination: SmoothieListKey | "custom-only";
		addedToList: boolean;
		message: string;
	};

	let {
		outcome,
		action,
		onMoveToShopping,
		onMoveToFridge,
		onUndo,
	}: {
		outcome: CustomIngredientOutcomeState;
		action: "move" | "undo" | null;
		onMoveToShopping: () => void | Promise<void>;
		onMoveToFridge: () => void | Promise<void>;
		onUndo: () => void | Promise<void>;
	} = $props();
</script>

<section class="custom-ingredient-outcome" role="status" aria-live="polite">
	<div>
		<strong>{outcome.message}</strong>
		<small>
			{#if outcome.addedToList && outcome.destination !== "custom-only"}
				Next: use it in Mix, move it, or undo the list add.
			{:else}
				Next: preview the nutrition or open Mix when you are ready.
			{/if}
		</small>
	</div>
	<div class="custom-ingredient-outcome__actions">
		<a href="/mix">Open Mix</a>
		{#if outcome.addedToList && outcome.destination === MIX_STORAGE_KEYS.fridge}
			<button
				type="button"
				class="secondary-action"
				onclick={onMoveToShopping}
				disabled={action !== null}
			>
				{action === "move" ? "Moving…" : "Move to Shopping"}
			</button>
		{:else if outcome.addedToList && outcome.destination === MIX_STORAGE_KEYS.shoppingList}
			<button
				type="button"
				class="secondary-action"
				onclick={onMoveToFridge}
				disabled={action !== null}
			>
				{action === "move" ? "Moving…" : "Move to Fridge"}
			</button>
		{/if}
		{#if outcome.addedToList}
			<button
				type="button"
				class="secondary-action"
				onclick={onUndo}
				disabled={action !== null}
			>
				{action === "undo" ? "Undoing…" : "Undo"}
			</button>
		{/if}
	</div>
</section>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.custom-ingredient-outcome {
		display: grid;
		gap: $app-gap-sm;
		padding: $app-gap-sm;
		color: $app-primary;
		background: $app-success-bg;
		border: $app-border;
		border-radius: $app-radius;

		div:first-child {
			display: grid;
			gap: 0.15rem;
		}

		strong {
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-bold;
			line-height: 1.35;
		}

		small {
			color: $app-muted;
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-medium;
			line-height: 1.4;
		}
	}

	.custom-ingredient-outcome__actions {
		display: flex;
		flex-wrap: wrap;
		gap: $app-gap-xs;

		a,
		button {
			width: fit-content;
			min-height: 2.15rem;
			padding: 0.42rem 0.7rem;
			border-radius: $app-radius-pill;
			font-family: $app-button-font-family;
			font-size: $app-font-size-sm;
			font-weight: $app-button-font-weight;
			line-height: $app-button-line-height;
			text-decoration: none;
		}

		a {
			color: $app-highlight-text;
			background: $app-highlight;
		}
	}

	.secondary-action {
		color: $app-primary;
		background: $app-accent;
	}

	@media (max-width: $app-breakpoint-sm) {
		.custom-ingredient-outcome__actions {
			display: grid;
			grid-template-columns: 1fr;

			a,
			button {
				width: 100%;
				text-align: center;
			}
		}
	}
</style>
