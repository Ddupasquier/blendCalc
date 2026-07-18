<script lang="ts">
	import { getFoodServings } from "$lib/utils/food/servings/foodServings";
	import { formatViewingGrams } from "$lib/utils/food/nutrients/nutritionDisplay";
	import type { NutritionServingSelectProps } from "./types";

	let {
		food,
		viewingGrams,
		onSelect,
	}: NutritionServingSelectProps = $props();

	const servings = $derived(getFoodServings(food));
	const selectedValue = $derived.by(() => {
		const servingIndex = servings.findIndex(
			(serving) => Math.abs(serving.gramWeight - viewingGrams) < 0.01,
		);
		if (servingIndex >= 0) return `serving-${servingIndex}`;
		if (Math.abs(viewingGrams - 100) < 0.01) return "standard-100g";
		return "custom";
	});

	const handleChange = (event: Event) => {
		const value = (event.currentTarget as HTMLSelectElement).value;
		if (value === "standard-100g") {
			onSelect(100);
			return;
		}
		const index = Number.parseInt(value.replace("serving-", ""), 10);
		const serving = servings[index];
		if (serving) onSelect(serving.gramWeight);
	};
</script>

{#if servings.length > 0}
	<label class="nutrition-serving-select">
		<span>Serving</span>
		<select value={selectedValue} onchange={handleChange}>
			{#if selectedValue === "custom"}
				<option value="custom">Custom amount · {formatViewingGrams(viewingGrams)}</option>
			{/if}
			{#each servings as serving, index}
				<option value={`serving-${index}`}>
					{serving.label} · {formatViewingGrams(serving.gramWeight)}
				</option>
			{/each}
			{#if !servings.some((serving) => Math.abs(serving.gramWeight - 100) < 0.01)}
				<option value="standard-100g">100g standard</option>
			{/if}
		</select>
	</label>
{/if}

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.nutrition-serving-select {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: $app-gap-md;
		padding-block: $app-gap-sm;
		border-bottom: $app-border-divider;

		span {
			color: $ingredient-text-muted;
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-bold;
			letter-spacing: 0.04em;
			text-transform: uppercase;
		}

		select {
			width: 100%;
			min-width: 0;
			min-height: $ingredient-control-height;
			padding-inline: $app-gap-sm;
			color: $ingredient-text-primary;
			font: inherit;
			font-weight: $app-font-weight-semibold;
			background: $ingredient-surface-control;
			border: 1px solid $ingredient-border-subtle;
			border-radius: $ingredient-radius-control;
		}
	}
</style>
