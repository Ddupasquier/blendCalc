<script lang="ts">
	let {
		class: className = "",
		size = 16,
		title,
	}: {
		class?: string;
		size?: number | string;
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
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
	role={title ? "img" : undefined}
	aria-hidden={title ? undefined : "true"}
>
	{#if title}
		<title>{title}</title>
	{/if}
	<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 10H5L3 8Z" />
	<path d="M5 18h14" />
</svg>
