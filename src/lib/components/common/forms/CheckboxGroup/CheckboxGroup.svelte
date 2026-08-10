<script lang="ts">
	import type { CheckboxGroupProps } from "./types";

	let {
		id = "checkbox-group",
		name,
		options = [],
		selected = [],
		disabled = false,
		onChange = () => {},
	}: CheckboxGroupProps = $props();

	const toggle = (optionId: string | number) => {
		const next = selected.includes(optionId)
			? selected.filter((selectedId) => selectedId !== optionId)
			: [...selected, optionId];
		onChange(next);
	};
</script>

<div class="checkbox-group">
	{#each options as option (option.id)}
		<label class="checkbox-item" class:checkbox-item--selected={selected.includes(option.id)}>
			<input
				class="sr-only"
				id={`${id}-${option.id}`}
				{name}
				type="checkbox"
				value={option.id}
				checked={selected.includes(option.id)}
				{disabled}
				onchange={() => toggle(option.id)}
			/>
			<span>{option.label}</span>
		</label>
	{/each}
</div>

<style lang="scss">
	@use "./CheckboxGroup.scss";
</style>
