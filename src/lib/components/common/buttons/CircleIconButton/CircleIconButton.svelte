<script lang="ts">
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import CenteredIcon from "$lib/components/common/icons/CenteredIcon/CenteredIcon.svelte";
	import type { CircleIconButtonProps } from "./types";

	let {
		type = "button",
		label,
		variant = "primary",
		size = "small",
		busy = false,
		disabled = false,
		pressed = undefined,
		class: className = "",
		"aria-describedby": ariaDescribedBy = undefined,
		onclick,
		onfocus,
		onkeydown,
		onkeyup,
		onpointerdown,
		onpointerup,
		onpointercancel,
		onlostpointercapture,
		oncontextmenu,
		children,
	}: CircleIconButtonProps = $props();
</script>

<button
	{type}
	class={`circle-icon-button ${className}`.trim()}
	data-variant={variant}
	data-size={size}
	aria-label={label}
	aria-busy={busy}
	aria-pressed={pressed}
	aria-describedby={ariaDescribedBy}
	disabled={disabled || busy}
	{onclick}
	{onfocus}
	{onkeydown}
	{onkeyup}
	{onpointerdown}
	{onpointerup}
	{onpointercancel}
	{onlostpointercapture}
	{oncontextmenu}
>
	<CenteredIcon>
		{#if busy}
			<LoadingSpinner size="small" decorative />
		{:else if children}
			{@render children()}
		{/if}
	</CenteredIcon>
</button>

<style lang="scss">
	@use "./CircleIconButton.scss";
</style>
