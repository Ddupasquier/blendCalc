<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
	import Pencil from "$lib/assets/icons/Pencil/Pencil.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import type { ManualEntryToggleProps } from "./types";

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
	@use "./ManualEntryToggle.scss";
</style>
