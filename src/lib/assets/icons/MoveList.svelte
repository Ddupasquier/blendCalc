<script lang="ts">
	let {
		class: className = "",
		size = 22,
		strokeWidth = 2,
		title,
	}: {
		class?: string;
		size?: number | string;
		strokeWidth?: number | string;
		title?: string;
	} = $props();
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
	<path d="M7 7h11" />
	<path d="m15 4 3 3-3 3" />
	<path d="M17 17H6" />
	<path d="m9 14-3 3 3 3" />
</svg>
