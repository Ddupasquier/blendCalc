<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
	import FoodSymbol from "$lib/assets/icons/FoodSymbol/FoodSymbol.svelte";
	import TwoStepConfirmation from "$lib/components/common/actions/TwoStepConfirmation/TwoStepConfirmation.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import CardWarningEdge from "$lib/components/common/display/CardWarningEdge/CardWarningEdge.svelte";
	import CircularMediaFrame from "$lib/components/common/images/CircularMediaFrame/CircularMediaFrame.svelte";
	import IngredientBulkToggle from "$lib/components/ingredients/list/IngredientBulkToggle/IngredientBulkToggle.svelte";
	import IngredientCardActions from "$lib/components/ingredients/list/IngredientCardActions/IngredientCardActions.svelte";
	import IngredientProvenanceBadges from "$lib/components/ingredients/provenance/IngredientProvenanceBadges/IngredientProvenanceBadges.svelte";
	import type { SavedIngredientCardProps } from "./types";

	let {
		food,
		active = false,
		checked = false,
		moving = false,
		removing = false,
		moveDirection,
		moveLabel,
		category,
		warning = null,
		provenanceOptions = [],
		onToggle,
		onPreview,
		onMove,
		onActions,
		onRemove,
	}: SavedIngredientCardProps = $props();
</script>

<article
	class="saved-ingredient-card"
	class:saved-ingredient-card--active={active}
	class:saved-ingredient-card--checked={checked}
	class:saved-ingredient-card--custom={food.customFood}
>
	{#if warning}
		<CardWarningEdge />
	{/if}
	<IngredientBulkToggle
		{checked}
		label={`${checked ? "Uncheck" : "Check"} ${food.description}`}
		{onToggle}
	/>
	<button
		class="saved-ingredient-card__select"
		type="button"
		aria-label={`Preview ${food.description}${warning ? `. Warning: ${warning}` : ""}`}
		onclick={onPreview}
	>
		<CircularMediaFrame class="saved-ingredient-card__icon">
			<FoodSymbol {food} />
		</CircularMediaFrame>
		<span class="saved-ingredient-card__copy">
			<span class="saved-ingredient-card__title-row">
				<strong title={food.description}>{food.description}</strong>
				<IngredientProvenanceBadges
					{food}
					{provenanceOptions}
				/>
			</span>
			<small>{category}</small>
		</span>
	</button>
	<span class="saved-ingredient-card__move-action">
		<CircleIconButton
			label={`${moveLabel}: ${food.description}`}
			variant="primary"
			size="small"
			busy={moving}
			disabled={moving}
			onclick={onMove}
		>
			<Chevron direction={moveDirection === "right" ? "left" : "right"} />
		</CircleIconButton>
	</span>
	<TwoStepConfirmation
		actionLabel={`Remove ${food.description}`}
		confirmationLabel={`Confirm deletion of ${food.description}`}
		message="Tap or click delete again to confirm."
		messageId={`saved-ingredient-delete-${food.fdcId}`}
		disabled={removing}
		onConfirm={onRemove}
	>
		{#snippet children({ armed, activate, label, messageId })}
			<IngredientCardActions
				description={food.description}
				{removing}
				removeArmed={armed}
				removeLabel={label}
				removeMessageId={messageId}
				{onActions}
				onRemove={activate}
			/>
		{/snippet}
	</TwoStepConfirmation>
</article>

<style lang="scss">
	@use "./SavedIngredientCard.scss";
</style>
