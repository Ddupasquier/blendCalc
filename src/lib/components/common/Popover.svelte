<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		buttonLabel = "Details",
		title = "",
		children,
	}: {
		buttonLabel?: string;
		title?: string;
		children?: Snippet;
	} = $props();

	let open = $state(false);
</script>

<div class="popover">
	<button
		class="popover__trigger"
		type="button"
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		{buttonLabel}
	</button>

	{#if open}
		<div class="popover__panel" role="dialog">
			{#if title}
				<h5>{title}</h5>
			{/if}
			{#if children}
				{@render children()}
			{/if}
			<button class="popover__close" type="button" onclick={() => (open = false)}>
				Close
			</button>
		</div>
	{/if}
</div>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.popover {
		position: relative;
		display: inline-flex;
		justify-content: flex-end;
	}

	.popover__trigger {
		padding: 0.25rem 0.55rem;
		color: $app-primary;
		background: $app-warning-bg;
		border: $app-warning-border;
		border-radius: $app-radius-pill;
		font-size: $app-font-size-sm;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
	}

	.popover__panel {
		position: absolute;
		right: 0;
		top: calc(100% + 0.4rem);
		z-index: 20;
		width: min(20rem, 82vw);
		padding: $app-gap-sm;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;
		box-shadow: $app-popover-shadow;
		color: $app-primary;
	}

	h5 {
		margin-bottom: $app-gap-sm;
		font-size: $app-font-size-lg;
		font-weight: 800;
	}

	.popover__close {
		margin-top: $app-gap-sm;
		padding: 0.35rem 0.7rem;
		background: $app-btn-bg;
		color: $app-btn-text;
		border-radius: $app-radius-pill;
		font-size: $app-font-size-sm;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
	}
</style>
