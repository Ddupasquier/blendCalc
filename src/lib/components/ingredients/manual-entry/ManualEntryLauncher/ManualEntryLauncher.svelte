<script lang="ts">
	import ManualEntryToggle from "$lib/components/ingredients/manual-entry/ManualEntryToggle/ManualEntryToggle.svelte";
	import type { ManualEntryLauncherProps } from "./types";

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
	@use "./ManualEntryLauncher.scss";
</style>
