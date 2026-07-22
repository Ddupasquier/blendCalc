<script lang="ts">
	import { searchNutrientCatalog } from "$lib/utils/mix/nutrients/nutrientSearch";
	import type { NutrientMeta } from "$lib/utils/mix/calculations";
	import type { NutrientPickerProps } from "./types";
	import {
		getNutrientCatalog,
		getPopularMixFields,
	} from "$lib/utils/food/reference/appReferenceCatalog";

	let {
		excludedIds,
		onSelect,
	}: NutrientPickerProps = $props();

	let isOpen = $state(false);
	let query = $state("");
	const nutrientCatalog = getNutrientCatalog();
	const popularNutrientIds = getPopularMixFields().map((nutrient) => nutrient.id);

	const availableNutrients = $derived(
		nutrientCatalog.filter(
			(nutrient) => !excludedIds.some((id) => id == nutrient.id),
		),
	);
	const popularNutrients = $derived(
		popularNutrientIds.flatMap((id) => {
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
	@use "./NutrientPicker.scss";
</style>
