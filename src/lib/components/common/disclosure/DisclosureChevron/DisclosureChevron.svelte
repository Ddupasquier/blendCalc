<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
	import type { DisclosureChevronProps } from "./types";

	let {
		class: className = "",
		open = false,
		size = "1em",
		strokeWidth = 2.4,
	}: DisclosureChevronProps = $props();
</script>

<span
	class={`disclosure-chevron ${className}`.trim()}
	data-open={open || undefined}
	aria-hidden="true"
>
	<Chevron direction="right" {size} {strokeWidth} />
</span>

<style lang="scss">
	@use "./DisclosureChevron.scss";
</style>
