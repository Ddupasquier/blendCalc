<script lang="ts">
	let {
		class: className = "",
		size = 20,
		strokeWidth = 2.2,
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
	<path d="m9 18 6-6-6-6" />
</svg>
