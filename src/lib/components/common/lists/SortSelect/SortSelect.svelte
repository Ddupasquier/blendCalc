<script lang="ts">
	import type { SortSelectProps } from "./types";

	let {
		id,
		label = "Sort",
		value,
		options,
		onChange,
	}: SortSelectProps = $props();
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
	@use "./SortSelect.scss";
</style>
