<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		title,
		subtitle,
		titleId,
		children,
	}: {
		title: string;
		subtitle?: string;
		titleId?: string;
		children?: Snippet;
	} = $props();
</script>

<header class="view-header">
	<h1 id={titleId}>{title}</h1>
	{#if subtitle}
		<p>{subtitle}</p>
	{/if}
	{#if children}
		{@render children()}
	{/if}
</header>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.view-header {
		min-width: 0;

		h1 {
			margin: 0 0 $app-gap-xs;
			color: $app-shell-text-primary;
			font-family: $app-font-family-display;
			font-size: clamp(1.75rem, 7vw, 2.1rem);
			font-weight: $app-font-weight-heavy;
			letter-spacing: -0.05em;
			line-height: 0.98;
		}

		p {
			max-width: 24rem;
			margin: 0;
			color: $app-shell-text-muted;
			font-size: $app-font-size-md;
			font-weight: $app-font-weight-medium;
			line-height: 1.35;
		}
	}
</style>
