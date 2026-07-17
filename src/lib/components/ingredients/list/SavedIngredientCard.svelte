<script lang="ts">
	import ArrowLeft from "$lib/assets/icons/ArrowLeft.svelte";
	import ChevronRight from "$lib/assets/icons/ChevronRight.svelte";
	import FoodSymbol from "$lib/assets/icons/FoodSymbol.svelte";
	import TwoStepConfirmation from "$lib/components/common/actions/TwoStepConfirmation.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton.svelte";
	import IngredientBulkToggle from "$lib/components/ingredients/list/IngredientBulkToggle.svelte";
	import IngredientCardActions from "$lib/components/ingredients/list/IngredientCardActions.svelte";
	import IngredientCardBadges from "$lib/components/ingredients/list/IngredientCardBadges.svelte";
	import type { FdcFood } from "$lib/utils/food/types";

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
		sourceLabel,
		onToggle,
		onPreview,
		onMove,
		onActions,
		onRemove,
	}: {
		food: FdcFood;
		active?: boolean;
		checked?: boolean;
		moving?: boolean;
		removing?: boolean;
		moveDirection: "left" | "right";
		moveLabel: string;
		category: string;
		warning?: string | null;
		sourceLabel: string;
		onToggle: () => void;
		onPreview: () => void;
		onMove: () => void;
		onActions: () => void;
		onRemove: () => void;
	} = $props();
</script>

<article
	class="saved-ingredient-card"
	class:saved-ingredient-card--active={active}
	class:saved-ingredient-card--checked={checked}
	class:saved-ingredient-card--custom={food.customFood}
>
	<IngredientBulkToggle
		{checked}
		label={`${checked ? "Uncheck" : "Check"} ${food.description}`}
		{onToggle}
	/>
	<button
		class="saved-ingredient-card__select"
		type="button"
		aria-label={`Preview ${food.description}`}
		onclick={onPreview}
	>
		<span class="saved-ingredient-card__icon">
			<FoodSymbol {food} />
		</span>
		<span class="saved-ingredient-card__copy">
			<IngredientCardBadges
				custom={food.customFood}
				{sourceLabel}
				{warning}
			/>
			<strong title={food.description}>{food.description}</strong>
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
			{#if moveDirection === "right"}
				<ArrowLeft size={17} strokeWidth={2.5} />
			{:else}
				<ChevronRight size={17} strokeWidth={2.5} />
			{/if}
		</CircleIconButton>
	</span>
	<TwoStepConfirmation
		actionLabel={`Remove ${food.description}`}
		confirmationLabel={`Confirm deletion of ${food.description}`}
		message="Tap delete again to confirm."
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
	@use "../../../../styles/variables" as *;

	.saved-ingredient-card {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto auto;
		align-items: center;
		gap: $app-gap-xs;
		min-height: $ingredient-card-min-height;
		padding: $app-gap-sm;
		background: $ingredient-surface-card;
		border: 1px solid transparent;
		border-radius: $ingredient-radius-card;
		transition:
			border-color 160ms ease,
			background-color 160ms ease,
			opacity 160ms ease;
	}

	.saved-ingredient-card--active {
		border-color: $ingredient-accent-primary;
		background: $ingredient-surface-card;
	}

	.saved-ingredient-card--custom {
		border-color: color-mix(in srgb, $app-custom-strong 45%, transparent);
		background: color-mix(in srgb, $app-custom-bg 18%, $ingredient-surface-card);
	}

	.saved-ingredient-card--checked {
		opacity: 0.72;

		.saved-ingredient-card__copy strong,
		.saved-ingredient-card__copy small {
			text-decoration: line-through;
		}
	}

	.saved-ingredient-card__select {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: $app-gap-sm;
		min-width: 0;
		padding: 0;
		color: inherit;
		text-align: left;
		background: transparent;
		border: 0;
	}

	.saved-ingredient-card__icon {
		display: inline-grid;
		place-items: center;
		width: $ingredient-food-icon-size;
		height: $ingredient-food-icon-size;
		overflow: hidden;
		background: $ingredient-surface-positive;
		border-radius: $ingredient-radius-pill;
		font-size: $ingredient-food-icon-font-size;
	}

	.saved-ingredient-card__copy {
		display: grid;
		gap: $app-gap-micro;
		min-width: 0;

		strong {
			overflow: hidden;
			color: $ingredient-text-primary;
			font-size: $app-font-size-md;
			font-weight: $app-font-weight-heavy;
			line-height: 1.08;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		small {
			overflow: hidden;
			color: $ingredient-text-muted;
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-medium;
			line-height: 1.15;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	.saved-ingredient-card__move-action {
		display: inline-grid;
		place-items: center;
	}

	@media (max-width: $app-breakpoint-xs) {
		.saved-ingredient-card {
			grid-template-columns: auto minmax(0, 1fr) auto auto;
		}

		.saved-ingredient-card__icon {
			display: none;
		}
	}
</style>
