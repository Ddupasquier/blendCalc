<script lang="ts">
	import type { ListControlsProps } from "./types";

	let {
		id,
		query,
		onQueryChange,
		placeholder = "Search this list…",
		label = "Search",
		totalCount,
		visibleCount,
		itemLabel = "items",
		filterLabel = "Filter",
		filterValue,
		filterOptions = [],
		onFilterChange,
	}: ListControlsProps = $props();

	const countText = $derived(
		visibleCount === totalCount
			? `${totalCount} ${itemLabel}`
			: `${visibleCount} of ${totalCount} ${itemLabel}`,
	);
</script>

<div
	class="list-controls"
	class:list-controls--search-only={filterOptions.length === 0}
>
	<label class="search-control" for={id}>
		<span>{label}</span>
		<input
			{id}
			name={id}
			type="search"
			value={query}
			{placeholder}
			oninput={(event) =>
				onQueryChange((event.currentTarget as HTMLInputElement).value)}
		/>
	</label>

	{#if filterOptions.length > 0 && filterValue !== undefined && onFilterChange}
		<label class="filter-control" for={`${id}-filter`}>
			<span>{filterLabel}</span>
			<select
				id={`${id}-filter`}
				name={`${id}-filter`}
				value={filterValue}
				onchange={(event) =>
					onFilterChange((event.currentTarget as HTMLSelectElement).value)}
			>
				{#each filterOptions as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</label>
	{/if}

	<p class="result-count" aria-live="polite">{countText}</p>
</div>

<style lang="scss">
	@use "./ListControls.scss";
</style>
