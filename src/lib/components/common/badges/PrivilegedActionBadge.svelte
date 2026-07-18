<script lang="ts">
	import Crown from "$lib/assets/icons/Crown.svelte";
	import CenteredIcon from "$lib/components/common/icons/CenteredIcon.svelte";
	import type { PrivilegedActionBadgeProps } from "$lib/components/common/badges/types";

	let {
		label = "Admin or moderator action",
		class: className = "",
		variant = "action",
	}: PrivilegedActionBadgeProps = $props();
</script>

<span
	class={`privileged-action-badge ${variant === "profile" ? "privileged-action-badge--profile" : ""} ${className}`.trim()}
	aria-hidden="true"
	title={label}
>
	<CenteredIcon>
		<Crown />
	</CenteredIcon>
</span>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	:global(.privileged-action-badge) {
		display: inline-grid;
		place-items: center;
		box-sizing: border-box;
		flex: 0 0 auto;
		width: $app-privileged-action-badge-size;
		height: $app-privileged-action-badge-size;
		color: $app-privileged-badge-color;
		font-size: $app-privileged-action-badge-icon-size;
		line-height: 1;
	}

	:global(.privileged-action-badge--profile) {
		width: $app-privileged-badge-size;
		height: $app-privileged-badge-size;
		font-size: $app-privileged-badge-icon-size;
	}

	:global(.privileged-action-badge svg) {
		width: 1em;
		height: 1em;
	}
</style>
