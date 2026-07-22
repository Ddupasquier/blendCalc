<script lang="ts">
	import WarningTriangle from "$lib/assets/icons/WarningTriangle/WarningTriangle.svelte";
	import type { ManualEntryValidationListProps } from "./types";

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
	@use "./ManualEntryValidationList.scss";
</style>
