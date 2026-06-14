<script lang="ts">
	import { searchNutrientCatalog } from "$lib/utils/mix/nutrientSearch";
	import type { NutrientMeta } from "$lib/utils/mix/mixCalculations";
	import {
		ALL_NUTRIENTS,
		POPULAR_NUTRIENT_IDS,
	} from "../../../variables/allNutrients";

	let {
		excludedIds,
		onSelect,
	}: {
		excludedIds: (string | number)[];
		onSelect: (id: string | number) => void;
	} = $props();

	let isOpen = $state(false);
	let query = $state("");

	const availableNutrients = $derived(
		ALL_NUTRIENTS.filter(
			(nutrient) => !excludedIds.some((id) => id == nutrient.id),
		),
	);
	const popularNutrients = $derived(
		POPULAR_NUTRIENT_IDS.flatMap((id) => {
			const nutrient = availableNutrients.find((item) => item.id === id);
			return nutrient ? [nutrient] : [];
		}),
	);
	const searchResults = $derived(
		searchNutrientCatalog(availableNutrients as NutrientMeta[], query),
	);
	const visibleNutrients = $derived(
		query.trim() ? searchResults : popularNutrients,
	);

	const selectNutrient = (id: string | number) => {
		onSelect(id);
		query = "";
	};
</script>

<div class="nutrient-picker">
	<button
		class="nutrient-picker__toggle"
		type="button"
		aria-expanded={isOpen}
		onclick={() => (isOpen = !isOpen)}
	>
		<span>Add nutrient</span>
		<span aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
	</button>

	{#if isOpen}
		<div class="nutrient-picker__panel">
			<label for="nutrient-search">Find a nutrient</label>
			<input
				id="nutrient-search"
				name="nutrient-search"
				type="search"
				placeholder="Search vitamins, minerals, fats…"
				autocomplete="off"
				bind:value={query}
			/>
			<p class="nutrient-picker__hint">
				{query.trim()
					? `${searchResults.length} closest matches`
					: "Popular choices — search to browse the full catalog"}
			</p>

			{#if visibleNutrients.length > 0}
				<div class="nutrient-picker__results">
					{#each visibleNutrients as nutrient (nutrient.id)}
						<button type="button" onclick={() => selectNutrient(nutrient.id)}>
							<span>{nutrient.label}</span>
							<small>{nutrient.unit}</small>
						</button>
					{/each}
				</div>
			{:else}
				<p class="nutrient-picker__empty">No matching nutrients.</p>
			{/if}
		</div>
	{/if}
</div>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.nutrient-picker {
		position: relative;
	}

	.nutrient-picker__toggle {
		display: flex;
		gap: $app-gap-xs;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		min-height: $app-control-height;
		padding: 0 $app-gap-sm;
		color: $app-primary;
		background: $app-btn-bg;
		border-radius: $app-radius-sm;
		font-size: $app-font-size-sm;
		font-weight: 800;
	}

	.nutrient-picker__panel {
		position: absolute;
		z-index: 20;
		top: calc(100% + #{$app-gap-xs});
		right: 0;
		width: min(26rem, calc(100vw - #{$app-gap-lg}));
		padding: $app-gap-sm;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-card-radius;
		box-shadow: $app-shadow;

		label {
			display: block;
			margin-bottom: $app-gap-xs;
			color: $app-primary;
			font-size: $app-font-size-sm;
			font-weight: 800;
		}

		input {
			width: 100%;
			height: $app-control-height;
			padding: 0 $app-gap-sm;
			color: $app-primary;
			background: $app-section-bg;
			border: $app-border;
			border-radius: $app-radius-sm;
			font-size: $app-font-size-md;
		}
	}

	.nutrient-picker__hint,
	.nutrient-picker__empty {
		margin: $app-gap-xs 0;
		color: $app-muted;
		font-size: $app-font-size-xs;
	}

	.nutrient-picker__results {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: $app-gap-xs;
		max-height: 18rem;
		overflow-y: auto;
		overscroll-behavior: contain;

		button {
			display: flex;
			gap: $app-gap-xs;
			align-items: center;
			justify-content: space-between;
			min-width: 0;
			padding: $app-gap-xs $app-gap-sm;
			color: $app-primary;
			text-align: left;
			background: $app-section-bg;
			border: $app-border;
			border-radius: $app-radius-sm;
			font-size: $app-font-size-sm;
			font-weight: $app-button-font-weight;
			line-height: $app-button-line-height;

			&:hover,
			&:focus-visible {
				background: $app-btn-bg;
			}

			span {
				min-width: 0;
				overflow-wrap: anywhere;
			}

			small {
				flex: 0 0 auto;
				color: $app-muted;
				font-size: $app-font-size-xs;
				font-weight: $app-font-weight-medium;
			}
		}
	}

	@media (max-width: $app-breakpoint-sm) {
		.nutrient-picker__panel {
			position: static;
			width: 100%;
			margin-top: $app-gap-xs;
			box-shadow: none;
		}

		.nutrient-picker__results {
			grid-template-columns: 1fr;
			max-height: 15rem;
		}
	}
</style>
