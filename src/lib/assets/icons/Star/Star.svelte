<script lang="ts">
	import type { StarProps } from "./types";
	let {
		size = 22,
		strokeWidth = 2.4,
		filled = false,
		title,
		class: className = "",
	}: StarProps = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill={filled ? "currentColor" : "none"}
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
	role={title ? "img" : undefined}
	aria-hidden={title ? undefined : "true"}
>
	{#if title}<title>{title}</title>{/if}
	<path
		d="m12 3 2.8 5.7 6.3.9-4.55 4.43 1.07 6.27L12 17.34l-5.62 2.96 1.07-6.27L2.9 9.6l6.3-.9L12 3Z"
	/>
</svg>
