<script lang="ts">
	import Crown from "$lib/assets/icons/Crown.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame.svelte";
	import type { PrivilegedActionBadgeProps } from "$lib/components/common/badges/types";

	let {
		label = "Admin or moderator action",
		class: className = "",
		variant = "action",
	}: PrivilegedActionBadgeProps = $props();
</script>

<CircularIconFrame
	class={`privileged-action-badge ${variant === "profile" ? "privileged-action-badge--profile" : ""} ${className}`.trim()}
	decorative
	title={label}
>
	<Crown size="var(--privileged-action-badge-icon-size)" />
</CircularIconFrame>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	:global(.privileged-action-badge) {
		--privileged-action-badge-icon-size: #{$app-privileged-action-badge-icon-size};
		--circular-icon-frame-size: #{$app-privileged-action-badge-size};
		--circular-icon-frame-icon-size: #{$app-privileged-action-badge-icon-size};
		--circular-icon-frame-color: #{$app-privileged-badge-text};
		--circular-icon-frame-background: #{$app-privileged-badge-bg};
		--circular-icon-frame-border: 1px solid #{$app-privileged-badge-border};
	}

	:global(.privileged-action-badge--profile) {
		--privileged-action-badge-icon-size: #{$app-privileged-badge-icon-size};
		--circular-icon-frame-size: #{$app-privileged-badge-size};
		--circular-icon-frame-icon-size: #{$app-privileged-badge-icon-size};
	}
</style>
