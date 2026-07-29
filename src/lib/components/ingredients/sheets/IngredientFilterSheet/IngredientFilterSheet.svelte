<script lang="ts">
	import ListSortSheet from "$lib/components/common/lists/ListSortSheet/ListSortSheet.svelte";
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

	const visibleSortOptions = $derived(
		sortOptions.filter((option) => option.value !== "name-desc"),
	);
</script>

<ListSortSheet
	{open}
	title="Sort"
	titleId="ingredient-filter-sheet-title"
	label="Sort saved ingredients"
	value={sortValue}
	options={visibleSortOptions}
	{loading}
	onApply={(nextSortValue) =>
		onApply({
			query,
			sortValue: nextSortValue,
		})}
	onClose={onClose}
/>
