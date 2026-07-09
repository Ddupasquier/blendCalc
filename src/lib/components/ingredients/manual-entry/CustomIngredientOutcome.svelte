<script lang="ts">
	import PillButton from "$lib/components/common/buttons/PillButton.svelte";
	import { MIX_STORAGE_KEYS } from "../../../../defaults/mixDefaults";
	import type { CustomIngredientOutcomeState } from "$lib/components/ingredients/manual-entry/formTypes";

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
			{#if outcome.addedToList}
				Next: use it in Mix, move it, or undo the list add.
			{:else}
				Next: preview the nutrition or open Mix when you are ready.
			{/if}
		</small>
	</div>
	<div class="custom-ingredient-outcome__actions">
		<a href="/mix">Open Mix</a>
		{#if outcome.addedToList && outcome.destination === MIX_STORAGE_KEYS.fridge}
			<PillButton
				variant="neutral"
				onclick={onMoveToShopping}
				disabled={action !== null}
			>
				{action === "move" ? "Moving…" : "Move to Shopping"}
			</PillButton>
		{:else if outcome.addedToList && outcome.destination === MIX_STORAGE_KEYS.shoppingList}
			<PillButton
				variant="neutral"
				onclick={onMoveToFridge}
				disabled={action !== null}
			>
				{action === "move" ? "Moving…" : "Move to Fridge"}
			</PillButton>
		{/if}
		{#if outcome.addedToList}
			<PillButton variant="neutral" onclick={onUndo} disabled={action !== null}>
				{action === "undo" ? "Undoing…" : "Undo"}
			</PillButton>
		{/if}
	</div>
</section>

<style lang="scss">
	@use "../../../../styles/variables" as *;

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
			gap: $app-gap-xs;
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

		a {
			width: fit-content;
			min-height: 2.15rem;
			padding: $ingredient-control-padding-y-compact $ingredient-control-padding-x-compact;
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

	@media (max-width: $app-breakpoint-sm) {
		.custom-ingredient-outcome__actions {
			display: grid;
			grid-template-columns: 1fr;

			a {
				width: 100%;
				text-align: center;
			}
		}
	}
</style>
