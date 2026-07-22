<script lang="ts">
	import WarningTriangle from "$lib/assets/icons/WarningTriangle.svelte";
	import type { ManualEntryValidationListProps } from "$lib/components/ingredients/manual-entry/formTypes";

	let {
		items,
	}: ManualEntryValidationListProps = $props();
</script>

{#if items.length > 0}
	<ul class="manual-entry-validation" aria-label="Manual entry validation">
		{#each items as item}
			<li class:manual-entry-validation__item--warning={item.tone === "warning"}>
				<span class="manual-entry-validation__icon" aria-hidden="true">
					<WarningTriangle size={16} />
				</span>
				{item.message}
			</li>
		{/each}
	</ul>
{/if}

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.manual-entry-validation {
		display: grid;
		gap: $app-gap-sm;
		padding: 0;
		margin: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: $app-gap-sm;
		padding: $app-status-padding-y $app-status-padding-x;
		color: $app-shell-text-primary;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-medium;
		background: $app-status-error-bg;
		border-radius: $app-shell-radius-pill;
	}

	.manual-entry-validation__item--warning {
		background: $app-status-warning-bg;
	}

	.manual-entry-validation__icon {
		color: $app-status-error-icon;
		flex: 0 0 auto;
	}

	.manual-entry-validation__item--warning .manual-entry-validation__icon {
		color: $app-status-warning-icon;
	}
</style>
