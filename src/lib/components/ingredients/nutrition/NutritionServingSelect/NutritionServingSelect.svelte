<script lang="ts">
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import type { SelectFieldOption } from "$lib/components/common/forms/SelectField/types";
	import { getFoodServings } from "$lib/utils/food/servings/foodServings";
	import { formatViewingGrams } from "$lib/utils/food/nutrients/nutritionDisplay";
	import { formatServingOrigin } from "$lib/utils/food/servings/servingDisplay";
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
	const servingOptions = $derived.by<SelectFieldOption[]>(() => [
		...(selectedValue === "custom"
			? [{ value: "custom", label: `Custom amount · ${formatViewingGrams(viewingGrams)}` }]
			: []),
		...servings.map((serving, index) => ({
			value: `serving-${index}`,
			label: `${serving.label} · ${formatViewingGrams(serving.gramWeight)} · ${formatServingOrigin(serving)}`,
		})),
		...(!servings.some((serving) => Math.abs(serving.gramWeight - 100) < 0.01)
			? [{ value: "standard-100g", label: "100g standard" }]
			: []),
	]);

	const handleChange = (value: string) => {
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
	<div class="nutrition-serving-select">
		<SelectField
			id={`nutrition-serving-${food.fdcId}`}
			label="Serving"
			layout="inline"
			value={selectedValue}
			options={servingOptions}
			onValueChange={handleChange}
		/>
	</div>
{/if}

<style lang="scss">
	@use "./NutritionServingSelect.scss";
</style>
