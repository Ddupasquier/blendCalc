<script lang="ts">
	import ManualEntryToggle from "$lib/components/ingredients/ManualEntryToggle.svelte";

	let {
		onSelect,
	}: {
		onSelect: () => void;
	} = $props();
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
	@use "../../../styles/variables" as *;

	.manual-entry-launcher {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: $app-gap-sm;
		min-height: 3.55rem;
		width: 100%;
		padding: $app-rebuild-card-padding-sm $app-rebuild-control-padding-x;
		color: $color-figma-ink;
		text-align: left;
		background: color-mix(in srgb, $color-figma-card 74%, $color-figma-canvas);
		border: 0;
		border-radius: $app-rebuild-radius;
		transition:
			background-color 160ms ease,
			transform 160ms ease;

		&:hover {
			background: $color-figma-card;
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
