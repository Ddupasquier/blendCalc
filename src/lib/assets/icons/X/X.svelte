<script lang="ts">
	import type { BasicIconProps } from "../types";

	let {
		class: className = "",
		size = 22,
		strokeWidth = 2.4,
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
	<path d="M6 6l12 12M18 6 6 18" />
</svg>
