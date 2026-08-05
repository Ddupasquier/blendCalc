<script lang="ts">
	import Search from "$lib/assets/icons/Search/Search.svelte";
	import Sliders from "$lib/assets/icons/Sliders/Sliders.svelte";
	import X from "$lib/assets/icons/X/X.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import IconControlButton from "$lib/components/common/buttons/IconControlButton/IconControlButton.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
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
		showCount = true,
		filterLabel = "Filter",
		filterValue,
		filterOptions = [],
		onFilterChange,
		filtersActive = false,
		filterControlsId,
		onFilterOpen,
	}: ListControlsProps = $props();

	const countText = $derived(
		visibleCount === totalCount
			? `${totalCount} ${itemLabel}`
			: `${visibleCount} of ${totalCount} ${itemLabel}`,
	);
</script>

<div
	class="list-controls"
	class:list-controls--search-only={filterOptions.length === 0 && !onFilterOpen}
	class:list-controls--filter-trigger={Boolean(onFilterOpen)}
>
	<div
		class="search-control"
		class:search-control--active={Boolean(query)}
	>
		<label class="sr-only" for={id}>{label}</label>
		<span class="search-control__icon" aria-hidden="true">
			<Search size={17} />
		</span>
		<input
			{id}
			name={id}
			type="search"
			value={query}
			{placeholder}
			oninput={(event) =>
				onQueryChange((event.currentTarget as HTMLInputElement).value)}
		/>
		{#if query}
			<span class="search-control__clear">
				<CircleIconButton
					label={`Clear ${label.toLowerCase()}`}
					variant="ghost"
					size="tiny"
					onclick={() => onQueryChange("")}
				>
					<X size={13} />
				</CircleIconButton>
			</span>
		{/if}
	</div>

	{#if onFilterOpen}
		<span class="list-controls__filter-trigger">
			<IconControlButton
				label={filterLabel}
				active={filtersActive}
				aria-expanded={filtersActive}
				aria-controls={filterControlsId}
				onclick={onFilterOpen}
			>
				<Sliders />
			</IconControlButton>
		</span>
	{:else if filterOptions.length > 0 && filterValue !== undefined && onFilterChange}
		<SelectField
			id={`${id}-filter`}
			name={`${id}-filter`}
			class="filter-control"
			label={filterLabel}
			labelVisibility="sr-only"
			value={filterValue}
			options={filterOptions}
			onValueChange={onFilterChange}
		/>
	{/if}

	{#if showCount}
		<p class="result-count" aria-live="polite">{countText}</p>
	{/if}
</div>

<style lang="scss">
	@use "./ListControls.scss";
</style>
