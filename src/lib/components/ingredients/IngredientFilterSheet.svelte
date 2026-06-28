<script lang="ts">
	import ActionButton from "$lib/components/common/ActionButton.svelte";
	import BottomSheet from "$lib/components/common/BottomSheet.svelte";

	type ListFilterOption = {
		value: string;
		label: string;
	};

	type SortOption = {
		value: string;
		label: string;
	};

	let {
		open,
		query,
		filterValue,
		filterOptions,
		sortValue,
		sortOptions,
		loading = false,
		onApply,
		onClose,
	}: {
		open: boolean;
		query: string;
		filterValue: string;
		filterOptions: ListFilterOption[];
		sortValue: string;
		sortOptions: readonly SortOption[];
		loading?: boolean;
		onApply: (filters: {
			query: string;
			filterValue: string;
			sortValue: string;
		}) => void;
		onClose: () => void;
	} = $props();

	let draftFilterValue = $state("");
	let draftSortValue = $state("");

	const visibleSortOptions = $derived(
		sortOptions.filter((option) => option.value !== "name-desc"),
	);

	const applyFilters = () => {
		onApply({
			query,
			filterValue: draftFilterValue,
			sortValue: draftSortValue,
		});
	};

	$effect(() => {
		if (!open) return;
		draftFilterValue = filterValue;
		draftSortValue = sortValue;
	});
</script>

<BottomSheet
	{open}
	title="Filter & Sort"
	titleId="ingredient-filter-sheet-title"
	label="Filter saved ingredients"
	onClose={onClose}
>
	<div class="ingredient-filter-sheet">
		<section class="ingredient-filter-sheet__section" aria-labelledby="filter-source-heading">
			<h3 id="filter-source-heading">Source</h3>
			<div class="ingredient-filter-sheet__chips" role="group" aria-labelledby="filter-source-heading">
				{#each filterOptions as option (option.value)}
					<button
						class="filter-chip"
						class:filter-chip--active={draftFilterValue === option.value}
						type="button"
						aria-pressed={draftFilterValue === option.value}
						onclick={() => (draftFilterValue = option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</section>

		<section class="ingredient-filter-sheet__section" aria-labelledby="filter-sort-heading">
			<h3 id="filter-sort-heading">Sort</h3>
			<div class="ingredient-filter-sheet__chips" role="group" aria-labelledby="filter-sort-heading">
				{#each visibleSortOptions as option (option.value)}
					<button
						class="filter-chip"
						class:filter-chip--active={draftSortValue === option.value}
						type="button"
						aria-pressed={draftSortValue === option.value}
						onclick={() => (draftSortValue = option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</section>

		{#if loading}
			<p class="ingredient-filter-sheet__status" role="status" aria-live="polite">
				Updating results…
			</p>
		{/if}

		<ActionButton fullWidth busy={loading} onclick={applyFilters}>
			Apply
		</ActionButton>
	</div>
</BottomSheet>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.ingredient-filter-sheet {
		display: grid;
		gap: $app-gap-lg;
	}

	.ingredient-filter-sheet__section {
		display: grid;
		gap: $app-gap-sm;

		h3 {
			margin: 0;
			color: $color-figma-muted;
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

	.filter-chip {
		min-height: $app-rebuild-control-height-sm;
		padding: 0 $app-gap-md;
		color: $color-figma-ink;
		background: $color-figma-soft-surface;
		border: 0;
		border-radius: $app-rebuild-radius-pill;
		font: inherit;
		font-size: $app-font-size-base;
		font-weight: $app-font-weight-bold;
		line-height: 1;
	}

	.filter-chip--active {
		color: $color-figma-card;
		background: $color-figma-green;
	}

	.filter-chip:focus-visible {
		outline: $app-focus-outline;
		outline-offset: $app-focus-outline-offset;
	}

	.ingredient-filter-sheet__status {
		margin: 0;
		color: $color-figma-muted;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
	}
</style>
