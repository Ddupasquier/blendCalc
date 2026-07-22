<script lang="ts">
	import { formatNutritionServingSize } from "$lib/utils/food/servings/servingDisplay";
	import type { NutritionServingStatementProps } from "./types";

	let { serving }: NutritionServingStatementProps = $props();
	const servingSize = $derived(serving ? formatNutritionServingSize(serving) : null);
</script>

{#if servingSize}
	<div class="nutrition-serving-statement">
		<span>Serving Size</span>
		<strong>{servingSize}</strong>
	</div>
{/if}

<style lang="scss">
	@use "./NutritionServingStatement.scss";
</style>
