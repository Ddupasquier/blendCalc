<script lang="ts">
	import CheckboxGroup from "$lib/components/common/forms/CheckboxGroup.svelte";
	import NutrientPicker from "$lib/components/mix/controls/NutrientPicker.svelte";
	import type { NutrientOption } from "$lib/utils/mix/ui/mixUi";

	let {
		options,
		selected,
		selectedCount,
		onChange,
		onAddNutrient,
	}: {
		options: NutrientOption[];
		selected: (string | number)[];
		selectedCount: number;
		onChange: (next: (string | number)[]) => void;
		onAddNutrient: (id: string | number) => void;
	} = $props();

</script>

<section class="setup-card setup-card--nutrients">
	<div class="panel-header">
		<div>
			<h3 id="nutrient-controls-title">Nutrients</h3>
			<p>{selectedCount} selected for the graph</p>
		</div>
		<NutrientPicker excludedIds={options.map((option) => option.id)} onSelect={onAddNutrient} />
	</div>

	<div class="mix-nutrients" aria-label="Selected nutrients">
		<CheckboxGroup {options} {selected} onChange={onChange} />
	</div>
</section>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.setup-card {
		padding: $app-gap-sm;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-card-radius;
	}

	.panel-header {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(220px, 300px);
		gap: $app-gap-sm;
		align-items: end;
		margin-bottom: $app-gap-sm;

		h3 {
			margin-bottom: 0.1rem;
			color: $app-primary;
			font-size: $app-font-size-lg;
			font-weight: 800;
		}

		p {
			color: $app-muted;
			font-size: $app-font-size-sm;
			font-weight: 600;
		}
	}

	.mix-nutrients {
		display: flex;
		align-content: flex-start;

		:global(.checkbox-group) {
			gap: 0.35rem;
		}

		:global(.checkbox-item) {
			min-height: 1.85rem;
			padding: 0.3rem 0.55rem;
			font-size: $app-font-size-sm;
		}

		:global(input) {
			width: 0.8rem;
			height: 0.8rem;
		}
	}

	@media (max-width: $app-breakpoint-md) {
		.panel-header {
			grid-template-columns: 1fr;
		}
	}
</style>
