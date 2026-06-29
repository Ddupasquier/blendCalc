<script lang="ts">
	import { cubicOut } from "svelte/easing";
	import type { Snippet } from "svelte";
	import { fly } from "svelte/transition";

	let {
		open = false,
		labelledby,
		onClose = () => {},
		children,
	}: {
		open?: boolean;
		labelledby: string;
		onClose?: () => void;
		children: Snippet;
	} = $props();

	const handleKeydown = (event: KeyboardEvent) => {
		if (!open || event.key !== "Escape") return;
		onClose();
	};
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="slide-in-view"
		role="dialog"
		aria-modal="false"
		aria-labelledby={labelledby}
		tabindex="-1"
	>
		<div
			class="slide-in-view__panel"
			transition:fly={{ x: "100%", duration: 240, easing: cubicOut }}
		>
			{@render children()}
		</div>
	</div>
{/if}

<style lang="scss">
	@use "../../../styles/variables" as *;

	.slide-in-view {
		position: fixed;
		inset: $app-shell-header-height 0 $app-shell-nav-height;
		z-index: 14;
		display: grid;
		justify-items: center;
		background: $app-shell-surface-page;
		pointer-events: auto;
	}

	.slide-in-view__panel {
		width: 100%;
		max-width: $app-shell-content-max-width;
		min-height: 100%;
		padding: $app-shell-padding-y $app-shell-padding-x 0;
		overflow-y: auto;
		background: $app-shell-surface-page;
		pointer-events: auto;
		box-sizing: border-box;
	}
</style>
