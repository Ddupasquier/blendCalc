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
	<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
	<path d="M5 20a7 7 0 0 1 14 0" />
</svg>
