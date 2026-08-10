<script lang="ts">
	import type { BasicIconProps } from "$lib/assets/icons/types";

	let {
		class: className = "",
		size = 18,
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
	<circle cx="12" cy="12" r="9" />
	<path d="M12 11v5" />
	<path d="M12 8h.01" />
</svg>

