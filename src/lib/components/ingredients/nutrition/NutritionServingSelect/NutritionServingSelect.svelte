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
	@use "./NutritionServingSelect.scss";
</style>
