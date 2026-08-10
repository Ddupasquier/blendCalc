<script lang="ts">
	import type { ManualEntryToggleRowProps } from "./types";

	let {
		title,
		description,
		disabled = false,
		children,
	}: ManualEntryToggleRowProps = $props();
</script>

<div class="manual-entry-toggle-row" class:manual-entry-toggle-row--disabled={disabled}>
	<span>
		<strong>{title}</strong>
		<small>{description}</small>
	</span>
	{@render children()}
</div>

<style lang="scss">
	@use "./ManualEntryToggleRow.scss";
</style>
