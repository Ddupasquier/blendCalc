<script lang="ts">
	import type { BasicIconProps } from "../types";

	let {
		class: className = "",
		size = 22,
		strokeWidth = 2,
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
	<path d="M4 7h16" />
	<path d="M10 11v6" />
	<path d="M14 11v6" />
	<path d="M6 7l1 14h10l1-14" />
	<path d="M9 7V4h6v3" />
</svg>
