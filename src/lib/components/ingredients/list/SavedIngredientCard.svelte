<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron.svelte";
	import FoodSymbol from "$lib/assets/icons/FoodSymbol.svelte";
	import TwoStepConfirmation from "$lib/components/common/actions/TwoStepConfirmation.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton.svelte";
	import CircularMediaFrame from "$lib/components/common/images/CircularMediaFrame.svelte";
	import IngredientBulkToggle from "$lib/components/ingredients/list/IngredientBulkToggle.svelte";
	import IngredientCardActions from "$lib/components/ingredients/list/IngredientCardActions.svelte";
	import IngredientProvenanceBadges from "$lib/components/ingredients/provenance/IngredientProvenanceBadges.svelte";
	import type { FdcFood } from "$lib/utils/food/types";
	import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";

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
		provenanceOptions?: readonly IngredientProvenanceOption[];
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
		<CircularMediaFrame class="saved-ingredient-card__icon">
			<FoodSymbol {food} />
		</CircularMediaFrame>
		<span class="saved-ingredient-card__copy">
			<IngredientProvenanceBadges
				{food}
				{provenanceOptions}
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
	@use "../../../../styles/variables" as *;

	.saved-ingredient-card {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto auto;
		align-items: center;
		gap: $app-gap-sm;
		min-height: $ingredient-card-min-height;
		padding: $ingredient-card-padding-compact;
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

	:global(.saved-ingredient-card__icon) {
		--circular-media-frame-size: #{$ingredient-food-icon-size};
		--circular-media-frame-background: #{$ingredient-surface-positive};
		--circular-media-frame-font-size: #{$ingredient-food-icon-font-size};
	}

	.saved-ingredient-card__copy {
		display: grid;
		gap: $app-gap-2xs;
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
		font-size: $ingredient-control-icon-size;
	}

	@media (max-width: $app-breakpoint-xs) {
		.saved-ingredient-card {
			grid-template-columns: auto minmax(0, 1fr) auto auto;
		}

		:global(.saved-ingredient-card__icon) {
			display: none;
		}
	}
</style>
