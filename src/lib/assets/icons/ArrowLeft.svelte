<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron.svelte";
	import type { BasicIconProps } from "$lib/assets/icons/types";

	let {
		class: className = "",
		size = 22,
		strokeWidth = 2,
		title,
	}: BasicIconProps = $props();
</script>

<Chevron direction="left" class={className} {size} {strokeWidth} {title} />
