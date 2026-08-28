<script lang="ts">
	import ListSortSheet from "$lib/components/common/lists/ListSortSheet/ListSortSheet.svelte";
	import {
		FOOD_SAFETY_FILTER_OPTIONS,
		FOOD_SAFETY_FILTER_VALUES,
		isFoodSafetyFilter,
	} from "$lib/utils/food/safety/foodSafetyFilters";
	import type { IngredientFilterSheetProps } from "./types";

	let {
		open,
		query,
		sortValue,
		sortOptions,
		safetyFilter,
		loading = false,
		onApply,
		onClose,
	}: IngredientFilterSheetProps = $props();

	const visibleSortOptions = $derived(
		sortOptions.filter((option) => option.value !== "name-desc"),
	);
	const resolveSafetyFilter = (value: string | undefined) => {
		const candidate = value ?? "";
		return isFoodSafetyFilter(candidate)
			? candidate
			: FOOD_SAFETY_FILTER_VALUES.all;
	};
</script>

<ListSortSheet
	{open}
	titleId="ingredient-filter-sheet-title"
	label="Filter and sort saved ingredients"
	value={sortValue}
	options={visibleSortOptions}
	filterValue={safetyFilter}
	filterOptions={FOOD_SAFETY_FILTER_OPTIONS}
	title="Filter and sort"
	{loading}
	onApply={(nextSortValue, nextSafetyFilter) =>
		onApply({
			query,
			sortValue: nextSortValue,
			safetyFilter: resolveSafetyFilter(nextSafetyFilter),
		})}
	{onClose}
/>
