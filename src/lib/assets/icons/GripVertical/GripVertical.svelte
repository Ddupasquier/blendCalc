<script lang="ts">
	import type { SolidIconProps } from "../types";

	let {
		class: className = "",
		size = 20,
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
	<circle cx="9" cy="6" r="1.5" />
	<circle cx="15" cy="6" r="1.5" />
	<circle cx="9" cy="12" r="1.5" />
	<circle cx="15" cy="12" r="1.5" />
	<circle cx="9" cy="18" r="1.5" />
	<circle cx="15" cy="18" r="1.5" />
</svg>
