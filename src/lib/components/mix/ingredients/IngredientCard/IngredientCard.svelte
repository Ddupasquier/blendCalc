<script lang="ts">
	import ChevronDown from "$lib/assets/icons/ChevronDown/ChevronDown.svelte";
	import Popover from "$lib/components/common/display/Popover/Popover.svelte";
	import NumberInput from "$lib/components/common/forms/NumberInput/NumberInput.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import CustomBadge from "$lib/components/common/display/CustomBadge/CustomBadge.svelte";
	import CloseButton from "$lib/components/common/buttons/CloseButton/CloseButton.svelte";
	import type { IngredientCardProps } from "./types";
	import { getFoodPreferenceContext } from "$lib/utils/profile/foodPreferenceContext.svelte";
	import {
		FOOD_PREFERENCE_WARNING_TITLE,
		getFoodPreferenceWarningMessage,
		getFoodPreferenceWarnings,
	} from "$lib/utils/profile/foodPreferenceWarnings";
	import { slide } from "svelte/transition";
	import {
		SERVING_MEASURE_OPTIONS,
		type ServingMeasureUnit,
	} from "$lib/utils/serving/servingMeasureCatalog";
	import { canConvertServingUnit } from "$lib/utils/serving/servingAmount";
	import { isPrivateCustomFood } from "$lib/utils/food/records/foodClassification";

	let {
		food,
		sourceLabel,
		quantity,
		unit,
		gramsLabel,
		warning = null,
		nutrientChips = [],
		onRemove,
		onServingChange,
	}: IngredientCardProps = $props();

	let nutrientsOpen = $state(false);
	const foodPreferenceContext = getFoodPreferenceContext();
	const preferenceWarnings = $derived(
		getFoodPreferenceWarnings(food, foodPreferenceContext.current),
	);

	const getDisplayName = (name: string, maxLength = 30): string => {
		if (name.length <= maxLength) return name;

		return `${name.slice(0, maxLength - 1).trimEnd()}…`;
	};
</script>

<article
	class="ingredient-card"
	class:ingredient-card--custom={isPrivateCustomFood(food)}
>
	<header class="ingredient-card__header">
		<div>
			<div class="ingredient-card__badges">
				<span class="ingredient-card__source">{sourceLabel}</span>
				{#if isPrivateCustomFood(food)}
					<CustomBadge />
				{/if}
			</div>
			<h5 title={food.description} aria-label={food.description}>
				{getDisplayName(food.description)}
			</h5>
		</div>
		<CloseButton
			class="ingredient-card__remove"
			size="small"
			label={`Remove ${food.description}`}
			onclick={() => onRemove(food.fdcId)}
		/>
	</header>

	<div class="ingredient-card__controls">
		<label>
			<span>Amount</span>
			<NumberInput
				id={`ingredient-${food.fdcId}-quantity`}
				name={`ingredient-${food.fdcId}-quantity`}
				class="ingredient-card__amount-input"
				min="0"
				step="any"
				placeholder="Amount"
				value={quantity}
				ariaLabel={`Quantity for ${food.description}`}
				onValueChange={(value) => onServingChange(food, value, unit)}
			/>
		</label>
		<label>
			<span>Unit</span>
			<select
				id={`ingredient-${food.fdcId}-unit`}
				name={`ingredient-${food.fdcId}-unit`}
				value={unit}
				aria-label={`Measure for ${food.description}`}
				onchange={(event) =>
					onServingChange(
						food,
						String(quantity),
						event.currentTarget.value as ServingMeasureUnit,
					)}
			>
				{#each SERVING_MEASURE_OPTIONS.filter((option) => canConvertServingUnit(option.value, food)) as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="ingredient-card__meta">
		<span class="ingredient-card__grams">Converted <strong>{gramsLabel}</strong></span>
		{#if warning}
			<Popover buttonLabel="⚠️ Estimate" title="Volume conversion estimate">
				<p>{warning}</p>
			</Popover>
		{/if}
	</div>

	{#if preferenceWarnings.length > 0}
		<div
			class="ingredient-card__warning"
			class:ingredient-card__warning--potential={!preferenceWarnings.some((item) => item.level === "warning")}
			>
				<strong>{FOOD_PREFERENCE_WARNING_TITLE}</strong>
				<p>
					{preferenceWarnings.map(getFoodPreferenceWarningMessage).join(" ")}
				</p>
		</div>
	{/if}

	{#if nutrientChips.length > 0}
		<div class="ingredient-card__details">
			<button
				class="ingredient-card__details-toggle"
				type="button"
					aria-expanded={nutrientsOpen}
					onclick={() => (nutrientsOpen = !nutrientsOpen)}
				>
					Top nutrients
					<CircularIconFrame
						class={`ingredient-card__chevron ${nutrientsOpen ? "ingredient-card__chevron--open" : ""}`}
						decorative
					>
						<ChevronDown size="1em" />
					</CircularIconFrame>
				</button>
			{#if nutrientsOpen}
				<div
					class="ingredient-card__chips"
					aria-label="Top nutrient contributions"
					transition:slide={{ duration: 160 }}
				>
					{#each nutrientChips as chip}
						<span>{chip.label} {chip.value}</span>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</article>

<style lang="scss">
	@use "./IngredientCard.scss";
</style>
