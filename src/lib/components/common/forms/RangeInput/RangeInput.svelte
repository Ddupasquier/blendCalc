<script lang="ts">
	import type { RangeInputProps } from "./types";

	let {
		id,
		name = id,
		class: className,
		value,
		min = 0,
		max,
		step = 1,
		fillValue = value,
		tone = "primary",
		disabled = false,
		ariaLabel,
		ariaValueText,
		onValueChange,
		onValueCommit,
		oninput,
		onchange,
	}: RangeInputProps = $props();

	const fillPercent = $derived.by(() => {
		const range = max - min;
		if (!Number.isFinite(range) || range <= 0) return 0;
		return Math.min(Math.max(((fillValue - min) / range) * 100, 0), 100);
	});

	const handleInput = (event: Event & { currentTarget: HTMLInputElement }) => {
		onValueChange?.(event.currentTarget.valueAsNumber, event);
		oninput?.(event);
	};
	const handleChange = (event: Event & { currentTarget: HTMLInputElement }) => {
		onValueCommit?.(event.currentTarget.valueAsNumber, event);
		onchange?.(event);
	};
</script>

<span
	class={`range-input range-input--${tone}${disabled ? " range-input--disabled" : ""}${className ? ` ${className}` : ""}`}
>
	<span class="range-input__track" aria-hidden="true">
		<span class="range-input__fill" style={`width: ${fillPercent}%`}></span>
	</span>
	<input
		{id}
		{name}
		class="range-input__control"
		type="range"
		{min}
		{max}
		{step}
		{value}
		{disabled}
		aria-label={ariaLabel}
		aria-valuetext={ariaValueText}
		oninput={handleInput}
		onchange={handleChange}
	/>
</span>

<style lang="scss">
	@use "./RangeInput.scss";
</style>
