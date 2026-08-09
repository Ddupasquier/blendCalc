<script lang="ts">
	import type { ManualEntryHelpTextProps } from "./types";

	let { children }: ManualEntryHelpTextProps = $props();
</script>

<p class="manual-entry-help-text">{@render children()}</p>

<style lang="scss">
	@use "./ManualEntryHelpText.scss";
</style>
