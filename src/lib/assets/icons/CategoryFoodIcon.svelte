<script lang="ts">
	import type { CategoryFoodIconProps } from "$lib/assets/icons/types";

	let {
		symbolKey = "generic",
		class: className = "",
		size = "1em",
		title,
	}: CategoryFoodIconProps = $props();
</script>

<svg
	class={className}
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden={title ? undefined : "true"}
	role={title ? "img" : undefined}
>
	{#if title}<title>{title}</title>{/if}
	{#if symbolKey === "fruit"}
		<path d="M12 8c-5-2-8 2-7 6 1 5 5 7 7 7s6-2 7-7c1-4-2-8-7-6Z" />
		<path d="M12 8c0-3 2-5 5-5M12 6C9 6 8 4 8 3c3-1 5 0 5 2" />
	{:else if symbolKey === "vegetables"}
		<path d="M12 21V9M12 13c-4 0-7-3-7-7 4 0 7 2 7 6M12 15c4 0 7-3 7-7-4 0-7 2-7 6" />
	{:else if symbolKey === "dairy"}
		<path d="M8 3h8l-1 4 2 3v11H7V10l2-3-1-4Z" />
		<path d="M8 11h9M9 7h6" />
	{:else if symbolKey === "meat"}
		<path d="M5 16c-3-4 1-10 6-12 5-2 9 2 8 6-1 5-8 9-14 6Z" />
		<circle cx="13" cy="9" r="2.2" />
	{:else if symbolKey === "seafood"}
		<path d="M4 12c4-5 10-5 14 0-4 5-10 5-14 0Z" />
		<path d="m18 12 3-4v8l-3-4ZM9 10v4" />
	{:else if symbolKey === "grains"}
		<path d="M12 21V4M12 8c-3 0-4-2-4-4 3 0 4 2 4 4ZM12 12c3 0 4-2 4-4-3 0-4 2-4 4ZM12 16c-3 0-4-2-4-4 3 0 4 2 4 4Z" />
	{:else if symbolKey === "nuts-seeds"}
		<path d="M12 3c5 4 7 9 4 14-2 4-6 5-9 2-4-4 0-12 5-16Z" />
		<path d="M8 17c3-2 5-6 5-11" />
	{:else if symbolKey === "beverage"}
		<path d="M7 8h10l-1 13H8L7 8ZM9 3h7l-2 5" />
	{:else if symbolKey === "sweets"}
		<path d="m7 9 10 6M7 15l10-6M7 9 5-3 5 3v6l-5 3-5-3V9Z" />
	{:else if symbolKey === "oils-fats"}
		<path d="M12 3s6 7 6 12a6 6 0 1 1-12 0c0-5 6-12 6-12Z" />
	{:else if symbolKey === "protein-powder"}
		<path d="M7 6h10l1 15H6L7 6ZM9 3h6v3" />
		<path d="M9 13h6M12 10v6" />
	{:else if symbolKey === "packaged"}
		<path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" />
		<path d="m4 7 8 4 8-4M12 11v10" />
	{:else}
		<path d="M4 9h16l-2 11H6L4 9Z" />
		<path d="M8 9a4 4 0 0 1 8 0M9 14h6" />
	{/if}
</svg>
