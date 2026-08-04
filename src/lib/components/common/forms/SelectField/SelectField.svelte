<script lang="ts">
	import ChevronDown from "$lib/assets/icons/ChevronDown/ChevronDown.svelte";
	import type { SelectFieldProps } from "./types";

	let {
		id,
		name = id,
		class: className = "",
		label,
		labelVisibility = "visible",
		ariaLabel,
		ariaDescribedBy,
		ariaInvalid = false,
		value = $bindable(""),
		options,
		helper,
		required = false,
		disabled = false,
		layout = "stacked",
		size = "default",
		width = "full",
		element = $bindable<HTMLSelectElement | null>(null),
		onValueChange,
	}: SelectFieldProps = $props();

	const helperId = $derived(helper ? `${id}-helper` : undefined);
	const describedBy = $derived(
		[ariaDescribedBy, helperId].filter(Boolean).join(" ") || undefined,
	);
	const rootClass = $derived(
		["select-field", className].filter(Boolean).join(" "),
	);

	const handleChange = (
		event: Event & { currentTarget: HTMLSelectElement },
	) => {
		value = event.currentTarget.value;
		onValueChange?.(value);
	};
</script>

{#snippet control()}
	<span class="select-field__control">
		<select
			bind:this={element}
			{id}
			{name}
			class="select-field__select"
			{value}
			{required}
			{disabled}
			aria-label={ariaLabel}
			aria-describedby={describedBy}
			aria-invalid={ariaInvalid || undefined}
			onchange={handleChange}
		>
			{#each options as option (option.value)}
				<option
					value={option.value}
					disabled={option.disabled}
					hidden={option.hidden}
				>
					{option.label}
				</option>
			{/each}
		</select>
		<span class="select-field__icon" aria-hidden="true">
			<ChevronDown size={16} strokeWidth={2.4} />
		</span>
	</span>
	{#if helper}
		<small id={helperId} class="select-field__helper">{helper}</small>
	{/if}
{/snippet}

<div
	class={rootClass}
	data-layout={layout}
	data-size={size}
	data-width={width}
>
	{#if label}
		<label
			for={id}
			class="select-field__label"
			class:select-field__label--sr-only={labelVisibility === "sr-only"}
		>
			{label}
		</label>
	{/if}
	{@render control()}
</div>

<style lang="scss">
	@use "./SelectField.scss";
</style>
