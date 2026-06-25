<script lang="ts">
	import type { FdcNutrient } from "$lib/utils/food/types";

	let {
		nutrients,
	}: {
		nutrients: FdcNutrient[];
	} = $props();

	const formatNutrientValue = (nutrient: FdcNutrient) => {
		const value =
			nutrient.value < 1
				? nutrient.value.toLocaleString(undefined, { maximumFractionDigits: 3 })
				: nutrient.value.toLocaleString(undefined, { maximumFractionDigits: 1 });
		const unit =
			nutrient.unitName.toUpperCase() === "UG"
				? "µg"
				: nutrient.unitName.toLowerCase();
		return `${value} ${unit}`;
	};
</script>

<details class="imported-nutrients">
	<summary>
		<span>Additional nutrients imported ({nutrients.length})</span>
		<small>Vitamins, minerals, and other values reported by the source.</small>
	</summary>
	<ul>
		{#each nutrients as nutrient (nutrient.nutrientId)}
			<li>
				<span>{nutrient.nutrientName}</span>
				<strong>{formatNutrientValue(nutrient)}</strong>
			</li>
		{/each}
	</ul>
	<p>
		Values are per serving. Nutrients not reported by the source are left
		missing rather than counted as zero.
	</p>
</details>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.imported-nutrients {
		padding: $app-gap-sm;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-radius;
	}

	summary {
		display: grid;
		gap: 0.1rem;
		color: $app-primary;
		cursor: pointer;
		font-weight: $app-font-weight-bold;
		list-style-position: inside;

		small {
			color: $app-muted;
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-medium;
		}
	}

	ul {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.35rem $app-gap-md;
		margin: $app-gap-sm 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		justify-content: space-between;
		gap: $app-gap-sm;
		min-width: 0;
		color: $app-muted;
		font-size: $app-font-size-sm;

		span {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		strong {
			flex: 0 0 auto;
			color: $app-primary;
			font-size: inherit;
		}
	}

	p {
		color: $app-muted;
		font-size: $app-font-size-sm;
		line-height: 1.4;
	}

	@media (max-width: $app-breakpoint-sm) {
		ul {
			grid-template-columns: 1fr;
		}
	}
</style>
