<script lang="ts">
	import type { ManualEntryHelperProps } from "./types";

	let { children }: ManualEntryHelperProps = $props();
</script>

<p class="manual-entry-helper">{@render children()}</p>

<style lang="scss">
	@use "./ManualEntryHelper.scss";
</style>
