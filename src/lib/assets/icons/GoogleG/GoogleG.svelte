<script lang="ts">
	import type { SolidIconProps } from "../types";

	let { class: className = "", size = 18, title }: SolidIconProps = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 18 18"
	fill="none"
	class={className}
	role={title ? "img" : undefined}
	aria-hidden={title ? undefined : "true"}
>
	{#if title}
		<title>{title}</title>
	{/if}
	<circle cx="9" cy="9" r="9" fill="#fff" />
	<path
		fill="#4285F4"
		d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.874 2.684-6.615Z"
	/>
	<path
		fill="#34A853"
		d="M9 18c2.43 0 4.468-.806 5.956-2.18l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.584-5.037-3.71H.956v2.332A9 9 0 0 0 9 18Z"
	/>
	<path
		fill="#FBBC05"
		d="M3.963 10.71A5.42 5.42 0 0 1 3.682 9c0-.593.102-1.17.281-1.71V4.957H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.043l3.007-2.332Z"
	/>
	<path
		fill="#EA4335"
		d="M9 3.58c1.322 0 2.508.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.957L3.963 7.29C4.672 5.164 6.656 3.58 9 3.58Z"
	/>
</svg>
