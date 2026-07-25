<script lang="ts">
	import FoodSymbol from "$lib/assets/icons/FoodSymbol/FoodSymbol.svelte";
	import TwoStepConfirmation from "$lib/components/common/actions/TwoStepConfirmation/TwoStepConfirmation.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import CardWarningEdge from "$lib/components/common/display/CardWarningEdge/CardWarningEdge.svelte";
	import CircularMediaFrame from "$lib/components/common/images/CircularMediaFrame/CircularMediaFrame.svelte";
	import IngredientCardActions from "$lib/components/ingredients/list/IngredientCardActions/IngredientCardActions.svelte";
	import IngredientCardFeatureImage from "$lib/components/ingredients/list/IngredientCardFeatureImage/IngredientCardFeatureImage.svelte";
	import IngredientMoveIcon from "$lib/components/ingredients/list/IngredientMoveIcon/IngredientMoveIcon.svelte";
	import IngredientSelectionIndicator from "$lib/components/ingredients/list/IngredientSelectionIndicator/IngredientSelectionIndicator.svelte";
	import IngredientProvenanceBadges from "$lib/components/ingredients/provenance/IngredientProvenanceBadges/IngredientProvenanceBadges.svelte";
	import {
		getFoodImageAltText,
		pickFoodFullImageUrl,
	} from "$lib/utils/food/images/foodImages";
	import { getStoredImagePlacement } from "$lib/utils/food/images/imagePlacement";
	import { isPrivateCustomFood } from "$lib/utils/food/records/foodClassification";
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

	const featureImageUrl = $derived(pickFoodFullImageUrl(food.image));
	const featureImageAlt = $derived(
		getFoodImageAltText({
			foodName: food.description,
			role: food.image?.role,
		}),
	);
	const featureImagePlacement = $derived(
		getStoredImagePlacement({
			cropX: food.image?.cropX,
			cropY: food.image?.cropY,
			cropZoom: food.image?.cropZoom,
			fitMode: food.image?.fitMode,
			placementVersion: food.image?.placementVersion,
		}),
	);
	let failedFeatureImageUrl = $state("");
	const showFeatureImage = $derived(
		Boolean(featureImageUrl) &&
			failedFeatureImageUrl !== featureImageUrl,
	);

	const handlePrimaryAction = () => {
		if (selectionMode) {
			onToggle();
			return;
		}
		onPreview();
	};

	const handleFeatureImageError = () => {
		failedFeatureImageUrl = featureImageUrl;
	};
</script>

<article
	class="saved-ingredient-card"
	class:saved-ingredient-card--active={active}
	class:saved-ingredient-card--checked={checked}
	class:saved-ingredient-card--custom={isPrivateCustomFood(food)}
	class:saved-ingredient-card--selection-mode={selectionMode}
	class:saved-ingredient-card--feature-image={showFeatureImage}
>
	{#if showFeatureImage}
		<IngredientCardFeatureImage
			imageUrl={featureImageUrl}
			alt={featureImageAlt}
			value={featureImagePlacement}
			decorative
			onError={handleFeatureImageError}
		/>
	{/if}
	{#if warning}
		<CardWarningEdge />
	{/if}
	<button
		class="saved-ingredient-card__select"
		class:saved-ingredient-card__select--selection-mode={selectionMode}
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
	>
		{#if !showFeatureImage}
			<CircularMediaFrame class="saved-ingredient-card__icon">
				<FoodSymbol {food} />
			</CircularMediaFrame>
		{/if}
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
			<IngredientSelectionIndicator selected={checked} />
		{/if}
	</button>
	{#if !selectionMode}
		<span class="saved-ingredient-card__move-action">
			<CircleIconButton
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
	{/if}
</article>

<style lang="scss">
	@use "./SavedIngredientCard.scss";
</style>
