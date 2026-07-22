<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron.svelte";
	import Pencil from "$lib/assets/icons/Pencil.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame.svelte";
	import type { ManualEntryToggleProps } from "$lib/components/ingredients/manual-entry/formTypes";

	let {
		title = "Enter manually",
		description = "Add a custom ingredient by hand",
	}: ManualEntryToggleProps = $props();
</script>

<CircularIconFrame class="manual-entry-toggle__icon" decorative>
	<Pencil size="1em" />
</CircularIconFrame>
<span class="manual-entry-toggle__copy">
	<strong>{title}</strong>
	<small>{description}</small>
</span>
<Chevron class="manual-entry-toggle__chevron" direction="down" />

<style lang="scss">
	@use "../../../../styles/variables" as *;

	:global(.manual-entry-toggle__icon) {
		--circular-icon-frame-size: #{$app-shell-leading-icon-size};
		--circular-icon-frame-icon-size: #{$app-shell-control-icon-size};
		--circular-icon-frame-color: #{$app-shell-accent-info};
		--circular-icon-frame-background: color-mix(
			in srgb,
			#{$app-shell-accent-info} 11%,
			#{$app-shell-surface-panel}
		);
		--circular-icon-frame-border: 0;
	}

	.manual-entry-toggle__copy {
		display: grid;
		gap: $app-gap-micro;
		min-width: 0;

		strong,
		small {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		strong {
			color: $app-shell-text-primary;
			font-size: $app-font-size-lg;
			font-weight: $app-font-weight-bold;
		}

		small {
			color: $app-shell-text-muted;
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-medium;
		}
	}

	:global(.manual-entry-toggle__chevron) {
		width: $app-shell-control-icon-size;
		height: $app-shell-control-icon-size;
		flex: 0 0 auto;
		transition: transform 180ms ease;
	}

	:global(.custom-ingredient__manual[open] .manual-entry-toggle__chevron) {
		transform: rotate(180deg);
	}
</style>
