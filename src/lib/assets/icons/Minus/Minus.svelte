<script lang="ts">
	import type { MinusProps } from "./types";

	let {
		size = 20,
		strokeWidth = 2,
		class: className = "",
	}: MinusProps = $props();
</script>

<svg
	class={className}
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<path d="M5 12h14" />
</svg>
