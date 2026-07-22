<script lang="ts">
	import type { ManualEntryFieldProps } from "./types";

	let {
		forId,
		label,
		optional = false,
		required = false,
		children,
	}: ManualEntryFieldProps = $props();
</script>

<div class="manual-entry-field">
	<label class="manual-entry-field__label" for={forId}>
		{label}
		{#if required}<em aria-hidden="true">*</em>{/if}
		{#if optional}<small>optional</small>{/if}
	</label>
	{@render children()}
</div>

<style lang="scss">
	@use "./ManualEntryField.scss";
</style>
