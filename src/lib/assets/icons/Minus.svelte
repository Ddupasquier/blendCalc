<script lang="ts">
	let {
		size = 20,
		strokeWidth = 2,
		class: className = "",
	}: {
		size?: number;
		strokeWidth?: number;
		class?: string;
	} = $props();
</script>

<svg
	class={className}
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<path d="M5 12h14" />
</svg>
