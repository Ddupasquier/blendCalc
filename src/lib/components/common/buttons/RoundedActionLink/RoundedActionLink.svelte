<script lang="ts">
	import type { RoundedActionLinkProps } from "./types";

	let {
		href,
		variant = "primary",
		contentAlign = "center",
		fullWidth = false,
		target,
		rel,
		ariaLabel,
		children,
	}: RoundedActionLinkProps = $props();
</script>

<a
	{href}
	{target}
	{rel}
	class="rounded-action-button"
	class:rounded-action-button--full={fullWidth}
	data-variant={variant}
	data-content-align={contentAlign}
	aria-label={ariaLabel}
>
	{#if children}
		{@render children()}
	{/if}
</a>

<style lang="scss">
	@use "./RoundedActionLink.scss";
</style>
