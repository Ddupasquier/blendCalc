<script lang="ts">
	import type { NumberInputProps } from "./types";

	let {
		id,
		name,
		class: className,
		value = "",
		min,
		max,
		step = "any",
		placeholder,
		required = false,
		disabled = false,
		readonly = false,
		autocomplete,
		ariaLabel,
		ariaRequired,
		ariaDescribedBy,
		selectOnFocus = true,
		onValueChange,
		onfocus,
		oninput,
	}: NumberInputProps = $props();

	const handleFocus = (event: FocusEvent & { currentTarget: HTMLInputElement }) => {
		if (selectOnFocus) event.currentTarget.select();
		onfocus?.(event);
	};

	const handleInput = (event: Event & { currentTarget: HTMLInputElement }) => {
		const numberValue = event.currentTarget.valueAsNumber;
		onValueChange?.(
			event.currentTarget.value,
			Number.isFinite(numberValue) ? numberValue : null,
			event,
		);
		oninput?.(event);
	};
</script>

<input
	{id}
	{name}
	class={className}
	type="number"
	{min}
	{max}
	{step}
	{placeholder}
	{required}
	{disabled}
	{readonly}
	{autocomplete}
	aria-label={ariaLabel}
	aria-required={ariaRequired}
	aria-describedby={ariaDescribedBy}
	value={value ?? ""}
	onfocus={handleFocus}
	oninput={handleInput}
/>
