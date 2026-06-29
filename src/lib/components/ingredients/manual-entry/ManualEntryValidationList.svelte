<script lang="ts">
	import WarningTriangle from "$lib/assets/icons/WarningTriangle.svelte";

	export type ManualEntryValidationItem = {
		message: string;
		tone: "error" | "warning";
	};

	let {
		items,
	}: {
		items: ManualEntryValidationItem[];
	} = $props();
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
		padding: $ingredient-status-padding-y $ingredient-status-padding-x;
		color: $ingredient-text-primary;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-medium;
		background: $ingredient-status-error-bg;
		border-radius: $ingredient-radius-pill;
	}

	.manual-entry-validation__item--warning {
		background: $ingredient-status-warning-bg;
	}

	.manual-entry-validation__icon {
		color: $ingredient-status-error-icon;
		flex: 0 0 auto;
	}

	.manual-entry-validation__item--warning .manual-entry-validation__icon {
		color: $ingredient-status-warning-icon;
	}
</style>
