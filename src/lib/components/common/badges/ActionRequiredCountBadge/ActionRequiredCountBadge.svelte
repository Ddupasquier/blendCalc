<script lang="ts">
	import type { ActionRequiredCountBadgeProps } from "./types";

	let {
		count,
		label,
		class: className = "",
	}: ActionRequiredCountBadgeProps = $props();

	const displayCount = $derived(count > 99 ? "99+" : `${count}`);
</script>

<span
	class={`action-required-count-badge ${className}`.trim()}
	aria-label={`${count} ${label}`}
	title={`${count} ${label}`}
>
	{displayCount}
</span>

<style lang="scss">
	@use "./ActionRequiredCountBadge.scss";
</style>
