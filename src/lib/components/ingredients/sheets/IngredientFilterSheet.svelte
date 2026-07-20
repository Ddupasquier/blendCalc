<script lang="ts">
	import ActionButton from "$lib/components/common/buttons/ActionButton.svelte";
	import PillButton from "$lib/components/common/buttons/PillButton.svelte";
	import BottomSheet from "$lib/components/common/sheets/BottomSheet.svelte";
	import type { IngredientFilterSheetProps } from "$lib/components/ingredients/sheets/types";

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
	@use "../../../../styles/variables" as *;

	.ingredient-filter-sheet {
		display: grid;
		gap: $app-gap-lg;
	}

	.ingredient-filter-sheet__section {
		display: grid;
		gap: $app-gap-sm;

		h3 {
			margin: 0;
			color: $ingredient-text-muted;
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-bold;
			line-height: 1;
			text-transform: uppercase;
			letter-spacing: $app-letter-spacing-label;
		}
	}

	.ingredient-filter-sheet__chips {
		display: flex;
		flex-wrap: wrap;
		gap: $app-horizontal-control-gap;
	}

</style>
