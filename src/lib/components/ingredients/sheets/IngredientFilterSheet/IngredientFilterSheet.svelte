<script lang="ts">
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import PillButton from "$lib/components/common/buttons/PillButton/PillButton.svelte";
	import BottomSheet from "$lib/components/common/sheets/BottomSheet/BottomSheet.svelte";
	import type { IngredientFilterSheetProps } from "./types";

	let {
		open,
		query,
		sortValue,
		sortOptions,
		loading = false,
		onApply,
		onClose,
	}: IngredientFilterSheetProps = $props();

	let draftSortValue = $state("");

	const visibleSortOptions = $derived(
		sortOptions.filter((option) => option.value !== "name-desc"),
	);

	const applyFilters = () => {
		onApply({
			query,
			sortValue: draftSortValue,
		});
	};

	$effect(() => {
		if (!open) return;
		draftSortValue = sortValue;
	});
</script>

<BottomSheet
	{open}
	title="Sort"
	titleId="ingredient-filter-sheet-title"
	label="Sort saved ingredients"
	onClose={onClose}
>
	<div class="ingredient-filter-sheet">
		<section class="ingredient-filter-sheet__section" aria-labelledby="filter-sort-heading">
			<h3 id="filter-sort-heading">Sort</h3>
			<div class="ingredient-filter-sheet__chips" role="group" aria-labelledby="filter-sort-heading">
				{#each visibleSortOptions as option (option.value)}
					<PillButton
						variant={draftSortValue === option.value ? "primary" : "neutral"}
						pressed={draftSortValue === option.value}
						onclick={() => (draftSortValue = option.value)}
					>
						{option.label}
					</PillButton>
				{/each}
			</div>
		</section>

		<ActionButton fullWidth variant="success" busy={loading} onclick={applyFilters}>
			Apply
		</ActionButton>
	</div>
</BottomSheet>

<style lang="scss">
	@use "./IngredientFilterSheet.scss";
</style>
