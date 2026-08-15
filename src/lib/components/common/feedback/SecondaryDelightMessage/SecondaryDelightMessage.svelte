<script lang="ts">
	import type { SecondaryDelightMessageProps } from "./types";

	let {
		message = null,
		class: className = "",
	}: SecondaryDelightMessageProps = $props();
</script>

{#if message}
	<p class={`secondary-delight-message ${className}`.trim()}>{message}</p>
{/if}

<style lang="scss">
	@use "./SecondaryDelightMessage.scss";
</style>
