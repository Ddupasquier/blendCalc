<script lang="ts">
	import type { TutorialStepIconProps } from "$lib/components/app/types";

	let { name }: TutorialStepIconProps = $props();
</script>

<svg
	viewBox="0 0 64 64"
	fill="none"
	stroke="currentColor"
	stroke-linecap="round"
	stroke-linejoin="round"
	stroke-width="2.5"
	aria-hidden="true"
>
	{#if name === "ingredients"}
		<path d="M17 15h30l-3 37H20l-3-37Z" />
		<path d="M14 15h36M25 15V9h14v6M25 25h14M25 33h14M25 41h9" />
	{:else if name === "goals"}
		<circle cx="32" cy="32" r="21" />
		<circle cx="32" cy="32" r="12" />
		<circle cx="32" cy="32" r="3" />
		<path d="m32 32 18-18M43 14h7v7" />
	{:else if name === "graph"}
		<path d="m32 8 21 15-8 25H19l-8-25 21-15Z" />
		<path d="m32 18 12 9-5 14H24l-5-14 13-9Z" />
		<path d="M32 8v40M11 23l34 25M53 23 19 48" />
	{:else}
		<path d="M14 10h30l7 7v37H14V10Z" />
		<path d="M23 10v15h20V10M22 54V36h20v18" />
	{/if}
</svg>
