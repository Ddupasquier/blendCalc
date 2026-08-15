<script lang="ts">
	import DotsHorizontal from "$lib/assets/icons/DotsHorizontal/DotsHorizontal.svelte";
	import X from "$lib/assets/icons/X/X.svelte";
	import TwoStepConfirmation from "$lib/components/common/actions/TwoStepConfirmation/TwoStepConfirmation.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import CardWarningEdge from "$lib/components/common/display/CardWarningEdge/CardWarningEdge.svelte";
	import CardSelectionIndicator from "$lib/components/common/display/CardSelectionIndicator/CardSelectionIndicator.svelte";
	import IngredientCardMedia from "$lib/components/ingredients/card/IngredientCardMedia/IngredientCardMedia.svelte";
	import IngredientMoveIcon from "$lib/components/ingredients/list/IngredientMoveIcon/IngredientMoveIcon.svelte";
	import IngredientProvenanceBadges from "$lib/components/ingredients/provenance/IngredientProvenanceBadges/IngredientProvenanceBadges.svelte";
	import { isPrivateCustomFood } from "$lib/utils/food/records/foodClassification";
	import { getFoodWarningEdgeTone } from "$lib/utils/ingredients/ingredientListUi";
	import { longPress } from "$lib/utils/interaction/longPress";
	import type { SavedIngredientCardProps } from "./types";

	let {
		food,
		active = false,
		checked = false,
		selectionMode = false,
		moving = false,
		removing = false,
		moveDirection,
		moveLabel,
		category,
		warning = null,
		provenanceOptions = [],
		onToggle,
		onEnterSelection,
		onPreview,
		onMove,
		onActions,
		onRemove,
	}: SavedIngredientCardProps = $props();

	const handlePrimaryAction = () => {
		if (selectionMode) {
			onToggle();
			return;
		}
		onPreview();
	};
	const warningEdgeTone = $derived(
		getFoodWarningEdgeTone(food) ?? (warning ? "warning" : null),
	);
</script>

<article
	class="saved-ingredient-card saved-ingredient-card--media"
	class:saved-ingredient-card--active={active}
	class:saved-ingredient-card--checked={checked}
	class:saved-ingredient-card--custom={isPrivateCustomFood(food)}
	class:saved-ingredient-card--selection-mode={selectionMode}
>
	<IngredientCardMedia {food} />
	{#if warning && warningEdgeTone}
		<CardWarningEdge tone={warningEdgeTone} />
	{/if}
	<button
		class="saved-ingredient-card__select"
		type="button"
		aria-label={selectionMode
			? `${checked ? "Unselect" : "Select"} ${food.description}`
			: `Preview ${food.description}${warning ? `. Warning: ${warning}` : ""}`}
		aria-pressed={selectionMode ? checked : undefined}
		use:longPress={{
			disabled: selectionMode,
			onLongPress: onEnterSelection,
		}}
		onclick={handlePrimaryAction}
	></button>
	<span class="saved-ingredient-card__copy">
		<span class="saved-ingredient-card__title-row">
			<strong title={food.description}>{food.description}</strong>
			<IngredientProvenanceBadges
				{food}
				{provenanceOptions}
				variant="saved-card"
			/>
		</span>
		<small>{category}</small>
	</span>
	{#if selectionMode}
		<span class="saved-ingredient-card__selection-indicator">
			<CardSelectionIndicator selected={checked} />
		</span>
	{/if}
	{#if !selectionMode}
		<span class="saved-ingredient-card__move-action">
			<CircleIconButton
				class="ingredient-card-action-button"
				label={`${moveLabel}: ${food.description}`}
				variant="primary"
				size="small"
				busy={moving}
				disabled={moving}
				onclick={onMove}
			>
				<IngredientMoveIcon
					direction={moveDirection === "right" ? "left" : "right"}
				/>
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
				<span class="saved-ingredient-card__actions">
					<CircleIconButton
						class="ingredient-card-action-button"
						label={`Open actions for ${food.description}`}
						variant="soft"
						size="small"
						onclick={onActions}
					>
						<DotsHorizontal size={16} />
					</CircleIconButton>
					<CircleIconButton
						class="ingredient-card-action-button"
						label={label}
						variant={armed ? "danger" : "soft"}
						size="small"
						busy={removing}
						disabled={removing}
						aria-describedby={armed ? messageId : undefined}
						onclick={activate}
					>
						<X size={16} strokeWidth={2.7} />
					</CircleIconButton>
				</span>
			{/snippet}
		</TwoStepConfirmation>
	{/if}
</article>

<style lang="scss">
	@use "./SavedIngredientCard.scss";
</style>
