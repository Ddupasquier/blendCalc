<script lang="ts">
	type SortOption = {
		value: string;
		label: string;
	};

	let {
		id,
		label = "Sort",
		value,
		options,
		onChange,
	}: {
		id: string;
		label?: string;
		value: string;
		options: readonly SortOption[];
		onChange: (value: string) => void;
	} = $props();
</script>

<label class="sort-select" for={id}>
	<span>{label}</span>
	<select
		{id}
		name={id}
		value={value}
		onchange={(event) =>
			onChange((event.currentTarget as HTMLSelectElement).value)}
	>
		{#each options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
</label>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.sort-select {
		display: grid;
		gap: $app-gap-xs;
		min-width: min(100%, 10rem);
		color: $app-primary;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
	}

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

	select:focus {
		border-color: $app-primary;
		outline: 3px solid rgb(79 72 66 / 10%);
	}
</style>
