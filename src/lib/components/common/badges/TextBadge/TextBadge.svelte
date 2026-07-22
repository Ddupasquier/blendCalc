<script lang="ts">
	import type { TextBadgeProps } from "./types";

	let {
		label,
		ariaLabel = undefined,
		title = undefined,
		tone = "info",
		class: className = "",
	}: TextBadgeProps = $props();
</script>

<span
	class={`text-badge ${className}`.trim()}
	data-tone={tone}
	aria-label={ariaLabel}
	{title}
>
	<span class="text-badge__label">{label}</span>
</span>

<style lang="scss">
	@use "./TextBadge.scss";
</style>
