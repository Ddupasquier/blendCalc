<script lang="ts">
	import Crown from "$lib/assets/icons/Crown/Crown.svelte";
	import CenteredIcon from "$lib/components/common/icons/CenteredIcon/CenteredIcon.svelte";
	import type { PrivilegedActionBadgeProps } from "./types";

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
	@use "./PrivilegedActionBadge.scss";
</style>
