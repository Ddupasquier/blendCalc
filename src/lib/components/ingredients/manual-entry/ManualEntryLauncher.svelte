<script lang="ts">
	import ManualEntryToggle from "$lib/components/ingredients/manual-entry/ManualEntryToggle.svelte";
	import type { ManualEntryLauncherProps } from "$lib/components/ingredients/manual-entry/formTypes";

	let {
		onSelect,
	}: ManualEntryLauncherProps = $props();
</script>

<button
	class="manual-entry-launcher"
	type="button"
	aria-label="Enter a custom ingredient manually"
	onclick={onSelect}
>
	<ManualEntryToggle />
</button>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.manual-entry-launcher {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: $app-gap-sm;
		min-height: calc($app-shell-control-height + ($app-gap-xs * 2));
		width: 100%;
		padding: $app-shell-card-padding-compact $app-shell-control-padding-x;
		color: $app-shell-text-primary;
		text-align: left;
		background: color-mix(in srgb, $app-shell-surface-panel 74%, $app-shell-surface-page);
		border: 0;
		border-radius: $app-shell-radius-card;
		transition:
			background-color 160ms ease,
			transform 160ms ease;

		&:hover {
			background: $app-shell-surface-panel;
		}

		&:active {
			transform: scale(0.99);
		}

		&:focus-visible {
			outline: $app-focus-outline;
			outline-offset: $app-gap-xs;
		}
	}
</style>
