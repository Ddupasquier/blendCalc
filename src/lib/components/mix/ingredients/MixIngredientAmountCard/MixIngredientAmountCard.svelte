<script lang="ts">
	import FoodSymbol from "$lib/assets/icons/FoodSymbol/FoodSymbol.svelte";
	import Minus from "$lib/assets/icons/Minus/Minus.svelte";
	import Plus from "$lib/assets/icons/Plus/Plus.svelte";
	import X from "$lib/assets/icons/X/X.svelte";
	import AcceleratingStepButton from "$lib/components/common/buttons/AcceleratingStepButton/AcceleratingStepButton.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import DisclosureChevron from "$lib/components/common/disclosure/DisclosureChevron/DisclosureChevron.svelte";
	import CardWarningEdge from "$lib/components/common/display/CardWarningEdge/CardWarningEdge.svelte";
	import Popover from "$lib/components/common/display/Popover/Popover.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import NumberInput from "$lib/components/common/forms/NumberInput/NumberInput.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import type { MixIngredientAmountCardProps } from "./types";
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
		sourceListLabel,
		servingQuantity,
		servingUnit,
		convertedWeightLabel,
		servingConversionBasis = null,
		servingConversionWarningMessage = null,
		nutrientContributionChips = [],
		isServingConversionDetailsOpen = false,
		onOpenConversionDetails,
		onCloseConversionDetails,
		onRemove,
		onServingChange,
	}: MixIngredientAmountCardProps = $props();

	let detailsOpen = $state(false);
	const preferenceWarnings = $derived(food.preferenceWarnings ?? []);
	const detailsElementId = $derived(`mix-ingredient-${food.fdcId}-details`);
	const servingUnitOptions = $derived(
		SERVING_MEASURE_OPTIONS
			.filter((option) => canConvertServingUnit(option.value, food))
			.map((option) => ({ value: option.value, label: option.shortLabel })),
	);
	const updateQuantity = (nextQuantity: number) =>
		onServingChange(food, String(Math.max(0, nextQuantity)), servingUnit);
</script>

<article
	class="mix-ingredient-amount-card"
	class:mix-ingredient-amount-card--custom={isPrivateCustomFood(food)}
	class:mix-ingredient-amount-card--warning={preferenceWarnings.length > 0}
>
	{#if preferenceWarnings.length > 0}<CardWarningEdge />{/if}
	<span class="mix-ingredient-amount-card__symbol" aria-hidden="true"><FoodSymbol {food} /></span>
	<div class="mix-ingredient-amount-card__copy">
		<h3 title={food.description}>{food.description}</h3>
		{#if convertedWeightLabel}<p>{convertedWeightLabel}</p>{/if}
	</div>
	<div class="mix-ingredient-amount-card__amount" aria-label={`Amount for ${food.description}`}>
		<AcceleratingStepButton
			label={`Use less ${food.description}`}
			variant="soft"
			size="small"
			disabled={servingQuantity <= 0}
			onStep={(stepAmount) => updateQuantity(servingQuantity - stepAmount)}
		>
			<Minus size={15} />
		</AcceleratingStepButton>
		<NumberInput
			id={`ingredient-${food.fdcId}-quantity`}
			name={`ingredient-${food.fdcId}-quantity`}
			class="mix-ingredient-amount-card__quantity-input"
			min="0"
			step="any"
			placeholder="Amount"
			value={servingQuantity}
			ariaLabel={`Quantity for ${food.description}`}
			onValueChange={(value) => onServingChange(food, value, servingUnit)}
		/>
		<AcceleratingStepButton
			label={`Use more ${food.description}`}
			variant="primary"
			size="small"
			onStep={(stepAmount) => updateQuantity(servingQuantity + stepAmount)}
		>
			<Plus size={15} />
		</AcceleratingStepButton>
		<SelectField
			id={`ingredient-${food.fdcId}-unit`}
			name={`ingredient-${food.fdcId}-unit`}
			class="mix-ingredient-amount-card__unit-select"
			label={`Measure for ${food.description}`}
			labelVisibility="sr-only"
			size="small"
			width="content"
			value={servingUnit}
			options={servingUnitOptions}
			onValueChange={(value) =>
				onServingChange(food, String(servingQuantity), value as ServingMeasureUnit)}
		/>
	</div>
	<div class="mix-ingredient-amount-card__actions">
		<CircleIconButton
			class="mix-ingredient-amount-card__details-toggle"
			label={detailsOpen
				? `Hide details for ${food.description}`
				: `${preferenceWarnings.length > 0 ? "Show warning and details" : "Show details"} for ${food.description}`}
			variant="soft"
			size="small"
			aria-expanded={detailsOpen}
			aria-controls={detailsElementId}
			onclick={() => (detailsOpen = !detailsOpen)}
		>
			<DisclosureChevron open={detailsOpen} size={15} />
		</CircleIconButton>
		<CircleIconButton
			class="mix-ingredient-amount-card__remove"
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
			id={detailsElementId}
			class="mix-ingredient-amount-card__details"
			transition:slide={{
				duration: getMotionSafeDuration(MOTION_DURATION_MS.feedback),
			}}
		>
			<p><strong>Source list:</strong> {sourceListLabel}</p>
			{#if servingConversionBasis}<p>{servingConversionBasis}</p>{/if}
			{#if servingConversionWarningMessage}
				<Popover
					open={isServingConversionDetailsOpen}
					buttonLabel="Review estimated conversion"
					title="Volume conversion estimate"
					onOpen={() => onOpenConversionDetails(food.fdcId)}
					onClose={onCloseConversionDetails}
				>
					<p>{servingConversionWarningMessage}</p>
				</Popover>
			{/if}
			{#if preferenceWarnings.length > 0}
				<StatusMessage
					tone="warning"
					title={FOOD_PREFERENCE_WARNING_TITLE}
					message={preferenceWarnings.map(getFoodPreferenceWarningMessage).join(" ")}
				/>
			{/if}
			{#if nutrientContributionChips.length > 0}
				<div class="mix-ingredient-amount-card__nutrient-chips" aria-label="Top nutrient contributions">
					{#each nutrientContributionChips as chip}<span>{chip.label} {chip.value}</span>{/each}
				</div>
			{/if}
		</div>
	{/if}
</article>

<style lang="scss">
	@use "./MixIngredientAmountCard.scss";
</style>
