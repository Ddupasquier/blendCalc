<script lang="ts">
	import type { SolidIconProps } from "../types";

	let {
		class: className = "",
		size = 22,
		title,
	}: SolidIconProps = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="currentColor"
	class={className}
	role={title ? "img" : undefined}
	aria-hidden={title ? undefined : "true"}
>
	{#if title}
		<title>{title}</title>
	{/if}
	<circle cx="5" cy="12" r="1.8" />
	<circle cx="12" cy="12" r="1.8" />
	<circle cx="19" cy="12" r="1.8" />
</svg>
