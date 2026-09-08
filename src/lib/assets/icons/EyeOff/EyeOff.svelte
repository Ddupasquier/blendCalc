<script lang="ts">
	import type { BasicIconProps } from "../types";

	let {
		class: className = "",
		size = 20,
		strokeWidth = 2.2,
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
	<path d="m3 3 18 18" />
	<path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
	<path
		d="M9.9 5.9A10.7 10.7 0 0 1 12 5.7c6.3 0 9.9 6.3 9.9 6.3a14.6 14.6 0 0 1-2.1 2.8"
	/>
	<path
		d="M6.2 6.2A15.5 15.5 0 0 0 2.1 12s3.6 6.3 9.9 6.3a10.3 10.3 0 0 0 4.1-.8"
	/>
</svg>
