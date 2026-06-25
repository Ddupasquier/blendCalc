<script lang="ts">
	let {
		class: className = "",
		width = 18,
		height = 14,
		title,
	}: {
		class?: string;
		width?: number | string;
		height?: number | string;
		title?: string;
	} = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 18 14"
	{width}
	{height}
	fill="currentColor"
	class={className}
	role={title ? "img" : undefined}
	aria-hidden={title ? undefined : "true"}
>
	{#if title}
		<title>{title}</title>
	{/if}
	<rect x="0" y="0" width="2" height="14" />
	<rect x="3.5" y="0" width="1" height="14" />
	<rect x="6" y="0" width="2.5" height="14" />
	<rect x="9.5" y="0" width="1" height="14" />
	<rect x="12" y="0" width="2" height="14" />
	<rect x="15.5" y="0" width="2.5" height="14" />
</svg>
