<script lang="ts">
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import type { SelectFieldOption } from "$lib/components/common/forms/SelectField/types";
	import {
		getFoodServings,
		prioritizeFoodServingsForUserDisplay,
	} from "$lib/utils/food/servings/foodServings";
	import { formatViewingGrams } from "$lib/utils/food/nutrients/nutritionDisplay";
	import { canViewFoodNutritionByMass } from "$lib/utils/food/nutrients/nutritionViewingAmount";
	import {
		formatNutritionServingSize,
		formatServingOrigin,
	} from "$lib/utils/food/servings/servingDisplay";
	import type { NutritionServingSelectProps } from "./types";

	let { food, selection, onSelect }: NutritionServingSelectProps = $props();

	const servings = $derived(getFoodServings(food));
	const prioritizedServings = $derived(
		prioritizeFoodServingsForUserDisplay(servings),
	);
	const canUseMass = $derived(canViewFoodNutritionByMass(food));
	const selectedValue = $derived(
		selection.kind === "serving"
			? `serving-${selection.servingIndex}`
			: selection.grams === 100
				? "standard-100g"
				: "custom-mass",
	);
	const servingOptions = $derived.by<SelectFieldOption[]>(() => [
		...(canUseMass && selection.kind === "mass" && selection.grams !== 100
			? [
					{
						value: "custom-mass",
						label: `Custom amount · ${formatViewingGrams(selection.grams)}`,
					},
				]
			: []),
		...prioritizedServings.map((serving) => ({
			value: `serving-${servings.indexOf(serving)}`,
			label: `${formatNutritionServingSize(serving)} · ${formatServingOrigin(serving)}`,
		})),
		...(canUseMass &&
		!servings.some(
			(serving) =>
				Number.isFinite(serving.gramWeight) &&
				Math.abs(Number(serving.gramWeight) - 100) < 0.01,
		)
			? [{ value: "standard-100g", label: "100g standard" }]
			: []),
	]);

	const handleChange = (value: string) => {
		if (value === "standard-100g") {
			onSelect({ kind: "mass", grams: 100 });
			return;
		}
		if (value === "custom-mass") return;
		const index = Number.parseInt(value.replace("serving-", ""), 10);
		const serving = servings[index];
		if (serving)
			onSelect({ kind: "serving", servingIndex: index, multiplier: 1 });
	};
</script>

{#if servings.length > 0 || canUseMass}
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
