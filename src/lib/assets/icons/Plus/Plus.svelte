<script lang="ts">
	import type { BasicIconProps } from "../types";

	let {
		class: className = "",
		size = 20,
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
	<path d="M12 5v14" />
	<path d="M5 12h14" />
</svg>
