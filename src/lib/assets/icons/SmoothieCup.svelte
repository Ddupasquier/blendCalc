<script lang="ts">
	let {
		class: className = "",
		size = 22,
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
	class={className}
	role={title ? "img" : undefined}
	aria-hidden={title ? undefined : "true"}
>
	{#if title}
		<title>{title}</title>
	{/if}
	<path d="M7 8h10l-1.1 12H8.1L7 8Z" fill="#f5f2eb" stroke="currentColor" stroke-width="1.5" />
	<path d="M8 11h8l-.75 7.5h-6.5L8 11Z" fill="#f7a6a1" />
	<path d="M9 3h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
	<path d="M14 8 16 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
	<path d="M6 8h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
	<path d="M9 14h6" stroke="currentColor" stroke-opacity=".28" stroke-width="1.2" stroke-linecap="round" />
</svg>
