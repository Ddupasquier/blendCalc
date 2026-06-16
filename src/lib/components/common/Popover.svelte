<script lang="ts">
	import type { Snippet } from "svelte";
	import CloseButton from "$lib/components/common/CloseButton.svelte";

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
		<div class="popover__panel" role="dialog" aria-label={title || buttonLabel}>
			<CloseButton
				class="popover__close"
				size="small"
				label={`Close ${title || buttonLabel}`}
				onclick={() => (open = false)}
			/>
			{#if title}
				<h5>{title}</h5>
			{/if}
			{#if children}
				{@render children()}
			{/if}
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
		padding: calc(1.75rem + 2 * $app-gap-xs) $app-gap-sm $app-gap-sm;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;
		color: $app-primary;
	}

	:global(.popover__close) {
		position: absolute;
		top: $app-gap-xs;
		right: $app-gap-xs;
	}

	h5 {
		margin-bottom: $app-gap-sm;
		font-size: $app-font-size-lg;
		font-weight: 800;
	}

</style>
