<script lang="ts">
	import type { TextFieldProps } from "./types";

	let {
		id,
		name,
		label,
		value = "",
		type = "text",
		placeholder,
		helper,
		required = false,
		disabled = false,
		maxlength,
		autocomplete,
		multiline = false,
		rows = 4,
		labelVisibility = "visible",
		oninput,
		onkeydown,
	}: TextFieldProps = $props();

	const helperId = $derived(helper ? `${id}-helper` : undefined);
</script>

<div class="text-field">
	<label
		for={id}
		class={`text-field__label${labelVisibility === "sr-only" ? " sr-only" : ""}`}
	>
		{label}
	</label>
	{#if multiline}
		<textarea
			{id}
			{name}
			{rows}
			{placeholder}
			{required}
			{disabled}
			{maxlength}
			aria-describedby={helperId}
			{oninput}
			{onkeydown}
		>{value ?? ""}</textarea>
	{:else}
		<input
			{id}
			{name}
			{type}
			{placeholder}
			{required}
			{disabled}
			{maxlength}
			{autocomplete}
			aria-describedby={helperId}
			value={value ?? ""}
			{oninput}
			{onkeydown}
		/>
	{/if}
	{#if helper}
		<small id={helperId} class="text-field__helper">{helper}</small>
	{/if}
</div>

<style lang="scss">
	@use "./TextField.scss";
</style>
