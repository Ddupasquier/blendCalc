<script lang="ts">
	import PillButton from "$lib/components/common/buttons/PillButton/PillButton.svelte";
	import SecondaryDelightMessage from "$lib/components/common/feedback/SecondaryDelightMessage/SecondaryDelightMessage.svelte";
	import { resolveFoodAddedDelightMessage } from "$lib/utils/delight/delightMessages";
	import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
	import type { CustomIngredientOutcomeProps } from "./types";

	let {
		outcome,
		action,
		allowPlayfulMessages = true,
		onMoveToShopping,
		onMoveToFridge,
		onUndo,
	}: CustomIngredientOutcomeProps = $props();

	const delightMessage = $derived(
		outcome.addedToList
			? resolveFoodAddedDelightMessage(outcome.food, allowPlayfulMessages)
			: null,
	);
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
		<SecondaryDelightMessage message={delightMessage} />
	</div>
	<div class="custom-ingredient-outcome__actions">
		<a href="/mix">Open Mix</a>
		{#if outcome.addedToList && outcome.destination === MIX_STORAGE_KEYS.fridge}
			<PillButton
				variant="neutral"
				onclick={onMoveToShopping}
				disabled={action !== null}
				busy={action === "move"}
			>
				Move to Shopping
			</PillButton>
		{:else if outcome.addedToList && outcome.destination === MIX_STORAGE_KEYS.shoppingList}
			<PillButton
				variant="neutral"
				onclick={onMoveToFridge}
				disabled={action !== null}
				busy={action === "move"}
			>
				Move to Fridge
			</PillButton>
		{/if}
		{#if outcome.addedToList}
			<PillButton
				variant="neutral"
				onclick={onUndo}
				disabled={action !== null}
				busy={action === "undo"}
			>
				Undo
			</PillButton>
		{/if}
	</div>
</section>

<style lang="scss">
	@use "./CustomIngredientOutcome.scss";
</style>
