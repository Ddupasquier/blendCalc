<script lang="ts">
	import type { LoadingSpinnerProps } from "./types";

	let {
		size = "medium",
		label = "Loading",
		showLabel = false,
		decorative = false,
		class: className = "",
	}: LoadingSpinnerProps = $props();
</script>

<span
	class={`loading-spinner ${className}`.trim()}
	data-size={size}
	role={decorative ? undefined : "status"}
	aria-live={decorative ? undefined : "polite"}
	aria-label={!decorative && !showLabel ? label : undefined}
	aria-hidden={decorative ? "true" : undefined}
>
	<span class="loading-spinner__ring" aria-hidden="true"></span>
	{#if showLabel}
		<span class="loading-spinner__label">{label}</span>
	{/if}
</span>

<style lang="scss">
	@use "./LoadingSpinner.scss";
</style>
