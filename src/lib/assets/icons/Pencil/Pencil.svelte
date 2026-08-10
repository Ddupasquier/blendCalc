<script lang="ts">
	import type { BasicIconProps } from "../types";

	let {
		class: className = "",
		size = 22,
		strokeWidth = 1.8,
		title,
	}: BasicIconProps = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
	role={title ? "img" : undefined}
	aria-hidden={title ? undefined : "true"}
>
	{#if title}
		<title>{title}</title>
	{/if}
	<path d="m4 20 4.2-1.1L19 8.1 15.9 5 5.1 15.8 4 20Z" />
	<path d="m14.8 6.1 3.1 3.1" />
</svg>
