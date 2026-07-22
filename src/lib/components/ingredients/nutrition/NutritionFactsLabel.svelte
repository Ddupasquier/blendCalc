<script lang="ts">
	import { onMount } from "svelte";
	import SourceAttribution from "$lib/components/common/display/SourceAttribution.svelte";
	import NutritionConfidenceDetails from "$lib/components/ingredients/nutrition/NutritionConfidenceDetails.svelte";
	import IngredientProvenanceBadges from "$lib/components/ingredients/provenance/IngredientProvenanceBadges.svelte";
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
	import { getNutritionFactsFields } from "$lib/utils/food/reference/appReferenceCatalog";
	import type { NutritionFactsLabelProps } from "./types";

	let {
		food,
		viewingGrams,
		viewingServing,
		provenanceOptions = [],
	}: NutritionFactsLabelProps = $props();
	const nutritionBasis = $derived(
		viewingServing ? "Amount per serving" : getNutritionBasisLabel(viewingGrams),
	);

	const nutritionFactsFields = getNutritionFactsFields();
	const vitalIds = nutritionFactsFields.map((field) => field.id);
	const foodQuality = $derived(food ? getFoodQuality(food) : null);
	const vitalRows = $derived(
		food
			? nutritionFactsFields.map((field) => {
					const value = getFdcNutrientValue(food, field.id);
					const scaledValue = scalePer100gValue(value, viewingGrams);
					return {
						label: field.label,
						value: scaledValue === null ? "—" : formatNutritionAmount(scaledValue),
						unit: scaledValue === null ? "" : field.unit,
						highlight: field.highlight,
					};
				})
			: [],
	);
	const extraRows = $derived(
		food
			? food.foodNutrients
					.filter(
						(n) =>
							!vitalIds.some((id) => isFdcNutrientMatch(n, id)),
					)
					.flatMap((n) => {
						const scaledValue = scalePer100gValue(n.value, viewingGrams);
						return scaledValue === null ? [] : [{
							label: n.nutrientName,
							value: formatNutritionAmount(scaledValue),
							unit: n.unitName,
						}];
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
	{#if food?.description}
		<div class="nf-food-details">
			<div class="nf-food-row">
				<div class="nf-food">{food.description}</div>
			</div>
			{#if food.sourceLabel}
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
	{#if foodQuality && (foodQuality.status === "partial" || foodQuality.status === "limited")}
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
		padding: $app-gap-md 1.0875rem
			1.0875rem;
		margin: 0 auto;
		overflow: hidden;
		color: #111;
		font-family: $app-font-family-data;
		background: #fff;
		border: 3.5px solid #111;
		border-radius: 0;
	}

	.nf-heading {
		display: grid;
		gap: $app-gap-2xs;
		padding-bottom: 0.13rem;
		margin-bottom: $app-gap-micro;
		border-bottom: 8px solid #111;
	}

	.nf-title {
		font-size: 2.1rem;
		font-weight: $app-font-weight-heavy;
		line-height: 1.1;
		letter-spacing: $app-letter-spacing-data;
		text-transform: uppercase;
	}

	.nf-heading-top {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: start;
		gap: $app-gap-sm;
	}

	.nf-heading-badges {
		display: flex;
		justify-content: flex-end;
		min-width: 0;
	}

	:global(.nf-heading-badges .ingredient-provenance-badges) {
		justify-content: flex-end;
		width: auto;
	}

	.nf-basis {
		max-width: none;
		padding-top: 0;
		color: #222;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
		line-height: 1.15;
		text-align: left;
		letter-spacing: 0;
		text-transform: none;
	}

	.nf-food-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: $app-gap-xs;
	}

	.nf-food-details {
		display: grid;
		gap: $app-gap-2xs;
	}

	.nf-food {
		min-width: 0;
		overflow-wrap: anywhere;
		color: #222;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-medium;
	}

	.nf-thick-divider {
		margin: $app-gap-2xs 0 $app-gap-xs;
		border-bottom: 4px solid #111;
	}

	.nf-divider {
		margin: $app-gap-micro 0;
		border-bottom: 2px solid #111;
	}

	.nf-columns {
		display: flex;
		align-items: stretch;
		gap: 1.0875rem;
		min-width: 0;
		min-height: 7.5rem;
		margin-bottom: $app-gap-2xs;
	}

	.vital-list {
		flex: 0 0 13.75rem;
		min-width: 11.25rem;
		max-width: 13.75rem;
		padding: 0;
		padding-right: 1.0875rem;
		margin: 0;
	}

	.nf-scroll-wrap {
		display: flex;
		align-items: stretch;
		flex: 1 1 0;
		min-width: 0;
		max-height: 100%;
		padding-left: 1.0875rem;
		overflow-x: hidden;
		overflow-y: auto;
		border-left: 3.5px solid #111;
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
		padding: 0.13rem
			0.1rem;
		color: #111;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-medium;
		background: none;
	}

	.nf-highlight {
		font-size: $app-font-size-lg;
		font-weight: $app-font-weight-heavy;
	}

	.nf-label-text {
		min-width: 0;
		overflow-wrap: anywhere;
		color: #111;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-semibold;
		letter-spacing: $app-letter-spacing-data;
		text-transform: uppercase;
	}

	.nf-calories-label {
		font-size: $app-font-size-lg;
		font-weight: $app-font-weight-heavy;
	}

	.nf-value {
		flex: 0 0 auto;
		color: #111;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-heavy;
	}

	.nf-calories-value {
		font-size: $app-font-size-lg;
		font-weight: $app-font-weight-heavy;
	}

	.nf-unit {
		margin-left: 0.13rem;
		color: #222;
		font-size: 0.82em;
		font-weight: $app-font-weight-regular;
		text-transform: uppercase;
	}

	@media (max-width: $app-breakpoint-sm) {
		.nf-label {
			padding: 0.65rem
				0.85rem
				0.95rem;
		}

		.nf-heading {
			gap: $app-gap-sm;
		}

		.nf-title {
			font-size: clamp(1.75rem, 10vw, 2.1rem);
		}

		.nf-heading-top {
			gap: $app-gap-xs;
		}

		.nf-basis {
			max-width: none;
			font-size: $app-font-size-sm;
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
			max-height: 9.5rem !important;
			padding-top: $app-gap-sm;
			padding-left: 0;
			border-top: 3.5px solid #111;
			border-left: 0;
		}

		.nf-row,
		.nf-label-text,
		.nf-value {
			font-size: $app-font-size-md;
		}

		.nf-highlight,
		.nf-calories-label,
		.nf-calories-value {
			font-size: $app-font-size-md;
		}
	}
</style>
