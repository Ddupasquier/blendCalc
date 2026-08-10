<script lang="ts">
	import type { BasicIconProps } from "$lib/assets/icons/types";

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
	{#if title}<title>{title}</title>{/if}
	<path d="M5 3h12l2 2v16H5z" />
	<path d="M8 3v6h8V3" />
	<path d="M8 21v-7h8v7" />
</svg>
