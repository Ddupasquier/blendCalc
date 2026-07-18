<script lang="ts">
	import { onMount } from "svelte";
	import CustomBadge from "$lib/components/common/display/CustomBadge.svelte";
	import SourceAttribution from "$lib/components/common/display/SourceAttribution.svelte";
	import NutritionConfidenceDetails from "$lib/components/ingredients/nutrition/NutritionConfidenceDetails.svelte";
	import NutritionServingStatement from "$lib/components/ingredients/nutrition/NutritionServingStatement.svelte";
	import {
		getFdcNutrientValue,
		isFdcNutrientMatch,
	} from "$lib/utils/food/nutrients/fdcNutrients";
	import {
		formatNutritionAmount,
		getNutritionBasisLabel,
		scalePer100gValue,
	} from "$lib/utils/food/nutrients/nutritionDisplay";
	import { getFoodQuality } from "$lib/utils/food/quality/foodQuality";
	import { vitalNutrients } from "../../../../variables/vitalNutrients";
	import type { NutritionFactsLabelProps } from "./types";

	let {
		food,
		viewingGrams,
		viewingServing,
	}: NutritionFactsLabelProps = $props();
	const nutritionBasis = $derived(
		viewingServing ? "Amount per serving" : getNutritionBasisLabel(viewingGrams),
	);

	const vitalIds = vitalNutrients.map((vn) => Number(vn.id));
	const foodQuality = $derived(food ? getFoodQuality(food) : null);
	const vitalRows = $derived(
		food
			? vitalNutrients.map((vn) => {
					const value = getFdcNutrientValue(food, Number(vn.id));
					return {
						label: vn.label,
						value: formatNutritionAmount(
							scalePer100gValue(value, viewingGrams),
						),
						unit: vn.unit,
						highlight: vn.highlight || false,
					};
				})
			: [],
	);
	const extraRows = $derived(
		food
			? food.foodNutrients
					.filter(
						(n) =>
							!vitalIds.some((id) => isFdcNutrientMatch(n, id)) &&
							n.value !== 0,
					)
					.map((n) => ({
						label: n.nutrientName,
						value: formatNutritionAmount(
							scalePer100gValue(n.value, viewingGrams),
						),
						unit: n.unitName,
					}))
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
		<div class="nf-title">Nutrition Facts</div>
		<NutritionServingStatement serving={viewingServing} />
		<div class="nf-basis">{nutritionBasis}</div>
	</div>
	{#if food?.description}
		<div class="nf-food-row">
			<div class="nf-food">{food.description}</div>
			{#if food.customFood}
				<CustomBadge />
			{/if}
		</div>
	{/if}
	{#if food?.sourceLabel}
		<SourceAttribution
			label={food.sourceLabel}
			dataType={food.sourceDataType ?? food.dataType}
		/>
	{/if}
	{#if foodQuality && (foodQuality.label === "Partial" || foodQuality.label === "Limited")}
		<NutritionConfidenceDetails quality={foodQuality} />
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
					<div class="nf-thick-divider"></div>
				{/if}
				{#if i === vitalRows.length - 2}
					<div class="nf-divider"></div>
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
	@use "../../../../styles/variables" as *;

	.nf-label {
		width: 100%;
		max-width: 100%;
		padding: $nutrition-label-padding-y $nutrition-label-padding-x
			$nutrition-label-padding-bottom;
		margin: 0 auto;
		overflow: hidden;
		color: $nutrition-label-text;
		font-family: $app-font-family-data;
		background: $nutrition-label-bg;
		border: $app-border-strong;
		border-radius: 0;
	}

	.nf-heading {
		display: grid;
		gap: $app-gap-2xs;
		padding-bottom: $nutrition-label-list-row-padding-y;
		margin-bottom: $nutrition-label-gap-micro;
		border-bottom: $app-border-highlight;
	}

	.nf-title {
		font-size: $nutrition-label-title-font-size;
		font-weight: $app-font-weight-heavy;
		line-height: $nutrition-label-title-line-height;
		letter-spacing: 0.01em;
		text-transform: uppercase;
	}

	.nf-basis {
		max-width: none;
		padding-top: 0;
		color: $nutrition-label-muted;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
		line-height: $nutrition-label-basis-line-height;
		text-align: left;
		letter-spacing: 0;
		text-transform: none;
	}

	.nf-food-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: $app-gap-xs;
		margin-bottom: $app-gap-2xs;
	}

	.nf-food {
		min-width: 0;
		overflow-wrap: anywhere;
		color: $nutrition-label-muted;
		font-size: $nutrition-label-food-font-size;
		font-weight: $app-font-weight-medium;
	}

	.nf-thick-divider {
		margin: $app-gap-2xs 0 $app-gap-xs;
		border-bottom: $app-border-thick;
	}

	.nf-divider {
		margin: $app-gap-micro 0;
		border-bottom: $app-border-divider;
	}

	.nf-columns {
		display: flex;
		align-items: stretch;
		gap: $nutrition-label-column-gap;
		min-width: 0;
		min-height: $nutrition-label-columns-min-height;
		margin-bottom: $app-gap-2xs;
	}

	.vital-list {
		flex: 0 0 $nutrition-label-main-column-width;
		min-width: $nutrition-label-main-column-min-width;
		max-width: $nutrition-label-main-column-width;
		padding: 0;
		padding-right: $nutrition-label-column-gap;
		margin: 0;
	}

	.nf-scroll-wrap {
		display: flex;
		align-items: stretch;
		flex: 1 1 0;
		min-width: 0;
		max-height: 100%;
		padding-left: $nutrition-label-column-gap;
		overflow-x: hidden;
		overflow-y: auto;
		border-left: $app-border-strong;
	}

	.nf-list {
		padding: 0;
		margin: 0;
		list-style: none;
	}

	.nf-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: $app-gap-sm;
		padding: $nutrition-label-list-row-padding-y
			$nutrition-label-list-row-padding-x;
		color: $nutrition-label-text;
		font-size: $nutrition-label-row-font-size;
		font-weight: $app-font-weight-medium;
		background: none;
	}

	.nf-highlight {
		font-size: $nutrition-label-highlight-font-size;
		font-weight: $app-font-weight-heavy;
	}

	.nf-label-text {
		min-width: 0;
		overflow-wrap: anywhere;
		color: $nutrition-label-text;
		font-size: $nutrition-label-row-font-size;
		font-weight: $app-font-weight-semibold;
		letter-spacing: 0.01em;
		text-transform: uppercase;
	}

	.nf-calories-label {
		font-size: $nutrition-label-highlight-font-size;
		font-weight: $app-font-weight-heavy;
	}

	.nf-value {
		flex: 0 0 auto;
		color: $nutrition-label-text;
		font-size: $nutrition-label-row-font-size;
		font-weight: $app-font-weight-heavy;
	}

	.nf-calories-value {
		font-size: $nutrition-label-highlight-font-size;
		font-weight: $app-font-weight-heavy;
	}

	.nf-unit {
		margin-left: $nutrition-label-list-row-padding-y;
		color: $nutrition-label-muted;
		font-size: $nutrition-label-unit-font-size;
		font-weight: $app-font-weight-regular;
		text-transform: uppercase;
	}

	@media (max-width: $app-breakpoint-xs) {
		.nf-label {
			padding: $nutrition-label-padding-y-mobile
				$nutrition-label-padding-x-mobile
				$nutrition-label-padding-bottom-mobile;
		}

		.nf-heading {
			gap: $app-gap-sm;
		}

		.nf-title {
			font-size: $nutrition-label-title-font-size-mobile;
		}

		.nf-basis {
			max-width: none;
			font-size: $app-font-size-xs;
		}

		.nf-columns {
			display: grid;
			grid-template-columns: 1fr;
			gap: $app-gap-sm;
			min-height: 0;
		}

		.vital-list {
			flex: none;
			width: 100%;
			min-width: 0;
			max-width: none;
			padding-right: 0;
		}

		.nf-scroll-wrap {
			width: 100%;
			max-height: $nutrition-label-scroll-max-height-mobile !important;
			padding-top: $app-gap-sm;
			padding-left: 0;
			border-top: $app-border-strong;
			border-left: 0;
		}

		.nf-row,
		.nf-label-text,
		.nf-value {
			font-size: $nutrition-label-row-font-size-mobile;
		}

		.nf-highlight,
		.nf-calories-label,
		.nf-calories-value {
			font-size: $nutrition-label-highlight-font-size-mobile;
		}
	}
</style>
