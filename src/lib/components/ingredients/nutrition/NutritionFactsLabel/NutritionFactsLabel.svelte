<script lang="ts">
	import { onMount } from "svelte";
	import SourceAttribution from "$lib/components/common/display/SourceAttribution/SourceAttribution.svelte";
	import IngredientProvenanceBadges from "$lib/components/ingredients/provenance/IngredientProvenanceBadges/IngredientProvenanceBadges.svelte";
	import NutritionServingStatement from "$lib/components/ingredients/nutrition/NutritionServingStatement/NutritionServingStatement.svelte";
	import {
		getNutrientAmountForServingConversion,
		isMatchingFoodNutrient,
		resolveFoodNutrient,
	} from "$lib/utils/food/nutrients/foodNutrients";
	import { formatNutritionAmount } from "$lib/utils/food/nutrients/nutritionDisplay";
	import { getNutritionFactsFields } from "$lib/utils/food/reference/appReferenceCatalog";
	import { getCanonicalFoodDescription } from "$lib/utils/food/records/foodRecords";
	import type { NutritionFactsLabelProps } from "./types";

	let {
		food,
		viewingConversion,
		viewingLabel,
		viewingServing,
		provenanceOptions = [],
	}: NutritionFactsLabelProps = $props();
	const nutritionBasis = $derived(
		viewingServing
			? "Amount per serving"
			: viewingLabel === "100g"
				? "Per 100g food data"
				: `Amount for ${viewingLabel}`,
	);
	const foodName = $derived(food ? getCanonicalFoodDescription(food) : "");

	const nutritionFactsFields = getNutritionFactsFields();
	const vitalIds = nutritionFactsFields.map((field) => field.id);
	const vitalRows = $derived(
		food
			? nutritionFactsFields.map((field) => {
					const nutrient = resolveFoodNutrient(food, field.id).nutrient;
					const scaledValue = nutrient
						? getNutrientAmountForServingConversion(
								nutrient,
								viewingConversion,
								food,
							)
						: 0;
					return {
						label: field.label,
						value:
							scaledValue === null ? "—" : formatNutritionAmount(scaledValue),
						unit: field.unit,
						highlight: field.highlight,
					};
				})
			: [],
	);
	const extraRows = $derived(
		food
			? food.foodNutrients
					.filter((n) => !vitalIds.some((id) => isMatchingFoodNutrient(n, id)))
					.flatMap((n) => {
						const scaledValue = getNutrientAmountForServingConversion(
							n,
							viewingConversion,
							food,
						);
						return scaledValue === null || scaledValue === 0
							? []
							: [
									{
										label: n.nutrientName,
										value: formatNutritionAmount(scaledValue),
										unit: n.unitName,
									},
								];
					})
			: [],
	);

	let vitalListRef: HTMLUListElement | null = null;
	let rightColHeight = $state(0);

	const syncHeight = () => {
		if (vitalListRef) rightColHeight = vitalListRef.offsetHeight;
	};

	$effect(() => {
		syncHeight();
	});

	onMount(() => {
		syncHeight();
		window.addEventListener("resize", syncHeight);
		return () => window.removeEventListener("resize", syncHeight);
	});
</script>

<div class="nf-label">
	<div class="nf-heading">
		<div class="nf-heading-top">
			<div class="nf-title">Nutrition Facts</div>
			{#if food}
				<div class="nf-heading-badges">
					<IngredientProvenanceBadges {food} {provenanceOptions} />
				</div>
			{/if}
		</div>
		<NutritionServingStatement serving={viewingServing} />
		<div class="nf-basis">{nutritionBasis}</div>
	</div>
	{#if foodName}
		<div class="nf-food-details">
			<div class="nf-food-row">
				<div class="nf-food">{foodName}</div>
			</div>
			{#if food?.sourceLabel}
				<SourceAttribution
					label={food.sourceLabel}
					dataType={food.sourceDataType ?? food.dataType}
				/>
			{/if}
		</div>
	{:else if food?.sourceLabel}
		<SourceAttribution
			label={food.sourceLabel}
			dataType={food.sourceDataType ?? food.dataType}
		/>
	{/if}
	<div class="nf-thick-divider"></div>
	<div class="nf-columns">
		<ul class="nf-list vital-list" bind:this={vitalListRef}>
			{#each vitalRows as row, i}
				<li class="nf-row {row.highlight ? 'nf-highlight' : ''}">
					<span class="nf-label-text {i === 0 ? 'nf-calories-label' : ''}">
						{row.label}
					</span>
					<span class="nf-value {i === 0 ? 'nf-calories-value' : ''}">
						{row.value}
						<span class="nf-unit">{row.unit}</span>
					</span>
				</li>
				{#if i === 0}
					<li class="nf-thick-divider" aria-hidden="true"></li>
				{/if}
				{#if i === vitalRows.length - 2}
					<li class="nf-divider" aria-hidden="true"></li>
				{/if}
			{/each}
		</ul>
		<div class="nf-scroll-wrap" style="max-height: {rightColHeight}px;">
			<ul class="nf-list extra-list">
				{#each extraRows as row}
					<li class="nf-row nf-extra">
						<span class="nf-label-text">{row.label}</span>
						<span class="nf-value">
							{row.value}
							<span class="nf-unit">{row.unit}</span>
						</span>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</div>

<style lang="scss">
	@use "./NutritionFactsLabel.scss";
</style>
