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
	<path d="m21 21-4.3-4.3" />
	<circle cx="11.5" cy="11.5" r="6.5" />
</svg>
