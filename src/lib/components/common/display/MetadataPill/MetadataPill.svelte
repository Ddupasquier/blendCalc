<script lang="ts">
	import type { MetadataPillProps } from "./types";

	let {
		label,
		value = undefined,
		ariaLabel = undefined,
		title = undefined,
		tone = "neutral",
		class: className = "",
		leading = undefined,
		trailing = undefined,
	}: MetadataPillProps = $props();
</script>

<span
	class={`metadata-pill ${className}`.trim()}
	data-tone={tone}
	aria-label={ariaLabel}
	{title}
>
	{#if leading}
		<span class="metadata-pill__leading" aria-hidden="true">
			{@render leading()}
		</span>
	{/if}
	<span class="metadata-pill__label">{label}</span>
	{#if value}
		<strong class="metadata-pill__value">{value}</strong>
	{/if}
	{#if trailing}
		<span class="metadata-pill__trailing">
			{@render trailing()}
		</span>
	{/if}
</span>

<style lang="scss">
	@use "./MetadataPill.scss";
</style>
