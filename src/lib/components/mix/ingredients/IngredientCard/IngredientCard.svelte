<script lang="ts">
	import FoodSymbol from "$lib/assets/icons/FoodSymbol/FoodSymbol.svelte";
	import Minus from "$lib/assets/icons/Minus/Minus.svelte";
	import Plus from "$lib/assets/icons/Plus/Plus.svelte";
	import X from "$lib/assets/icons/X/X.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import DisclosureChevron from "$lib/components/common/disclosure/DisclosureChevron/DisclosureChevron.svelte";
	import Popover from "$lib/components/common/display/Popover/Popover.svelte";
	import NumberInput from "$lib/components/common/forms/NumberInput/NumberInput.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import type { IngredientCardProps } from "./types";
	import {
		FOOD_PREFERENCE_WARNING_TITLE,
		getFoodPreferenceWarningMessage,
	} from "$lib/utils/profile/foodPreferenceWarnings";
	import { slide } from "svelte/transition";
	import {
		SERVING_MEASURE_OPTIONS,
		type ServingMeasureUnit,
	} from "$lib/utils/serving/servingMeasureCatalog";
	import { canConvertServingUnit } from "$lib/utils/serving/servingAmount";
	import { isPrivateCustomFood } from "$lib/utils/food/records/foodClassification";
	import {
		getMotionSafeDuration,
		MOTION_DURATION_MS,
	} from "$lib/utils/animation/motion";

	let {
		food,
		sourceLabel,
		quantity,
		unit,
		gramsLabel,
		conversionBasis = null,
		warning = null,
		nutrientChips = [],
		conversionDetailsOpen = false,
		onOpenConversionDetails,
		onCloseConversionDetails,
		onRemove,
		onServingChange,
	}: IngredientCardProps = $props();

	let detailsOpen = $state(false);
	const preferenceWarnings = $derived(food.preferenceWarnings ?? []);
	const servingUnitOptions = $derived(
		SERVING_MEASURE_OPTIONS
			.filter((option) => canConvertServingUnit(option.value, food))
			.map((option) => ({ value: option.value, label: option.shortLabel })),
	);
	const updateQuantity = (nextQuantity: number) =>
		onServingChange(food, String(Math.max(0, nextQuantity)), unit);
</script>

<article class="ingredient-card" class:ingredient-card--custom={isPrivateCustomFood(food)}>
	<span class="ingredient-card__symbol" aria-hidden="true"><FoodSymbol {food} /></span>
	<div class="ingredient-card__copy">
		<h3 title={food.description}>{food.description}</h3>
		<p>{gramsLabel}</p>
	</div>
	<div class="ingredient-card__amount" aria-label={`Amount for ${food.description}`}>
		<CircleIconButton
			class="ingredient-card__step"
			label={`Use less ${food.description}`}
			variant="soft"
			size="small"
			disabled={quantity <= 0}
			onclick={() => updateQuantity(quantity - 1)}
		>
			<Minus size={15} />
		</CircleIconButton>
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
		<CircleIconButton
			class="ingredient-card__step ingredient-card__step--add"
			label={`Use more ${food.description}`}
			variant="primary"
			size="small"
			onclick={() => updateQuantity(quantity + 1)}
		>
			<Plus size={15} />
		</CircleIconButton>
		<SelectField
			id={`ingredient-${food.fdcId}-unit`}
			name={`ingredient-${food.fdcId}-unit`}
			class="ingredient-card__unit-select"
			label={`Measure for ${food.description}`}
			labelVisibility="sr-only"
			size="small"
			width="content"
			value={unit}
			options={servingUnitOptions}
			onValueChange={(value) =>
				onServingChange(food, String(quantity), value as ServingMeasureUnit)}
		/>
	</div>
	<div class="ingredient-card__actions">
		<CircleIconButton
			class="ingredient-card__details-toggle"
			label={`${detailsOpen ? "Hide" : "Show"} details for ${food.description}`}
			variant="soft"
			size="small"
			aria-expanded={detailsOpen}
			onclick={() => (detailsOpen = !detailsOpen)}
		>
			<DisclosureChevron open={detailsOpen} size={15} />
		</CircleIconButton>
		<CircleIconButton
			class="ingredient-card__remove"
			label={`Remove ${food.description}`}
			variant="danger-soft"
			size="small"
			onclick={() => onRemove(food.fdcId)}
		>
			<X size={15} />
		</CircleIconButton>
	</div>

	{#if detailsOpen}
		<div
			class="ingredient-card__details"
			transition:slide={{
				duration: getMotionSafeDuration(MOTION_DURATION_MS.feedback),
			}}
		>
			<p><strong>Source list:</strong> {sourceLabel}</p>
			{#if conversionBasis}<p>{conversionBasis}</p>{/if}
			{#if warning}
				<Popover
					open={conversionDetailsOpen}
					buttonLabel="Review estimated conversion"
					title="Volume conversion estimate"
					onOpen={() => onOpenConversionDetails(food.fdcId)}
					onClose={onCloseConversionDetails}
				>
					<p>{warning}</p>
				</Popover>
			{/if}
			{#if preferenceWarnings.length > 0}
				<div class="ingredient-card__warning">
					<strong>{FOOD_PREFERENCE_WARNING_TITLE}</strong>
					<p>{preferenceWarnings.map(getFoodPreferenceWarningMessage).join(" ")}</p>
				</div>
			{/if}
			{#if nutrientChips.length > 0}
				<div class="ingredient-card__chips" aria-label="Top nutrient contributions">
					{#each nutrientChips as chip}<span>{chip.label} {chip.value}</span>{/each}
				</div>
			{/if}
		</div>
	{/if}
</article>

<style lang="scss">
	@use "./IngredientCard.scss";
</style>
