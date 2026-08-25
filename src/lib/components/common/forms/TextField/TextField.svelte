<script lang="ts">
	import type { FormEventHandler } from "svelte/elements";
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
		minlength,
		maxlength,
		showCharacterCount = false,
		autocomplete,
		multiline = false,
		rows = 4,
		labelVisibility = "visible",
		"aria-describedby": externalDescribedBy = undefined,
		"aria-invalid": ariaInvalid = undefined,
		oninput,
		onkeydown,
	}: TextFieldProps = $props();

	const helperId = $derived(helper ? `${id}-helper` : undefined);
	const characterCountId = $derived(
		showCharacterCount && maxlength !== undefined
			? `${id}-character-count`
			: undefined,
	);
	const describedBy = $derived(
		[externalDescribedBy, helperId, characterCountId]
			.filter(Boolean)
			.join(" ") || undefined,
	);
	let characterCount = $state(0);

	$effect(() => {
		characterCount = String(value ?? "").length;
	});

	const handleInput: FormEventHandler<
		HTMLInputElement | HTMLTextAreaElement
	> = (event) => {
		characterCount = event.currentTarget.value.length;
		oninput?.(event);
	};
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
			{minlength}
			{maxlength}
			aria-describedby={describedBy}
			aria-invalid={ariaInvalid}
			oninput={handleInput}
			{onkeydown}>{value ?? ""}</textarea
		>
	{:else}
		<input
			{id}
			{name}
			{type}
			{placeholder}
			{required}
			{disabled}
			{minlength}
			{maxlength}
			{autocomplete}
			aria-describedby={describedBy}
			aria-invalid={ariaInvalid}
			value={value ?? ""}
			oninput={handleInput}
			{onkeydown}
		/>
	{/if}
	{#if helper || characterCountId}
		<div class="text-field__support">
			{#if helper}
				<small id={helperId} class="text-field__helper">{helper}</small>
			{/if}
			{#if characterCountId && maxlength !== undefined}
				<small
					id={characterCountId}
					class="text-field__character-count"
					aria-live="polite"
					aria-atomic="true"
				>
					<span aria-hidden="true">{characterCount} / {maxlength}</span>
					<span class="sr-only"
						>{Math.max(0, maxlength - characterCount)} characters remaining</span
					>
				</small>
			{/if}
		</div>
	{/if}
</div>

<style lang="scss">
	@use "./TextField.scss";
</style>
