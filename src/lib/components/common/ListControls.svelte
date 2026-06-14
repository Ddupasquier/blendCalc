<script lang="ts">
	export type ListFilterOption = {
		value: string;
		label: string;
	};

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
	}: {
		id: string;
		query: string;
		onQueryChange: (value: string) => void;
		placeholder?: string;
		label?: string;
		totalCount: number;
		visibleCount: number;
		itemLabel?: string;
		filterLabel?: string;
		filterValue?: string;
		filterOptions?: ListFilterOption[];
		onFilterChange?: (value: string) => void;
	} = $props();

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
	@use "../../../styles/variables" as *;

	.list-controls {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(8rem, auto) auto;
		align-items: end;
		gap: $app-gap-sm;
		padding: $app-gap-sm;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius;
	}

	.list-controls--search-only {
		grid-template-columns: minmax(0, 1fr) auto;
	}

	.search-control,
	.filter-control {
		display: grid;
		gap: $app-gap-xs;
		min-width: 0;
		color: $app-primary;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
	}

	input,
	select {
		width: 100%;
		min-width: 0;
		height: $app-control-height;
		padding: 0 0.65rem;
		color: $app-primary;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-radius-sm;
		font: inherit;
		font-weight: $app-font-weight-medium;
	}

	input:focus,
	select:focus {
		border-color: $app-primary;
		outline: 3px solid rgb(79 72 66 / 10%);
	}

	.result-count {
		align-self: center;
		margin: 1.1rem 0 0;
		color: $app-muted;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-semibold;
		white-space: nowrap;
	}

	@media (max-width: $app-breakpoint-sm) {
		.list-controls {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.search-control {
			grid-column: 1 / -1;
		}

		.result-count {
			margin-top: 1.1rem;
		}

		.list-controls--search-only .result-count {
			grid-column: 1 / -1;
			margin-top: 0;
		}
	}
</style>
