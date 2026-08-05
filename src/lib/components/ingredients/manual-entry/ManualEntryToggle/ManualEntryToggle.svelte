<script lang="ts">
	import Pencil from "$lib/assets/icons/Pencil/Pencil.svelte";
	import DisclosureChevron from "$lib/components/common/disclosure/DisclosureChevron/DisclosureChevron.svelte";
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
<DisclosureChevron class="manual-entry-toggle__chevron" />

<style lang="scss">
	@use "./ManualEntryToggle.scss";
</style>
