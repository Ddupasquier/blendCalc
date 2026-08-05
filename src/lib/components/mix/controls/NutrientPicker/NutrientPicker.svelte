<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import ListControls from "$lib/components/common/lists/ListControls/ListControls.svelte";
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
	<CollapsibleSection
		title="Add nutrient"
		open={isOpen}
		onOpenChange={(open) => (isOpen = open)}
	>
		<div class="nutrient-picker__content">
			<ListControls
				id="nutrient-search"
				label="Find a nutrient"
				placeholder="Search vitamins, minerals, fats…"
				query={query}
				onQueryChange={(value) => (query = value)}
				totalCount={availableNutrients.length}
				visibleCount={visibleNutrients.length}
				itemLabel="nutrients"
			/>
			{#if visibleNutrients.length > 0}
				<div class="nutrient-picker__results" aria-label="Available nutrients">
					{#each visibleNutrients as nutrient (nutrient.id)}
						<RoundedActionButton
							fullWidth
							contentAlign="space-between"
							variant="neutral"
							onclick={() => selectNutrient(nutrient.id)}
						>
							<span class="nutrient-picker__label">{nutrient.label}</span>
							<span class="nutrient-picker__unit">{nutrient.unit}</span>
						</RoundedActionButton>
					{/each}
				</div>
			{:else}
				<p class="nutrient-picker__empty">No matching nutrients.</p>
			{/if}
		</div>
	</CollapsibleSection>
</div>

<style lang="scss">
	@use "./NutrientPicker.scss";
</style>
