<script lang="ts">
	import type { ChevronProps } from "$lib/assets/icons/types";

	let {
		class: className = "",
		direction = "down",
		size = "1em",
		strokeWidth = 2.4,
		title,
	}: ChevronProps = $props();

	const rotation = $derived(
		{
			down: 0,
			left: 90,
			up: 180,
			right: -90,
		}[direction],
	);
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
	<path d="m6 9 6 6 6-6" transform={`rotate(${rotation} 12 12)`} />
</svg>
