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
	@use "../../../../styles/variables" as *;

	.nutrition-serving-statement {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: $app-gap-sm;
		color: #111;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-bold;
		line-height: 1.15;
	}

	strong {
		font: inherit;
		text-align: right;
	}
</style>
