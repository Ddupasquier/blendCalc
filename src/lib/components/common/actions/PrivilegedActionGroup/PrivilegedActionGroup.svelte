<script lang="ts">
	import PrivilegedActionBadge from "$lib/components/common/badges/PrivilegedActionBadge/PrivilegedActionBadge.svelte";
	import type { PrivilegedActionGroupProps } from "./types";

	let {
		title = "Moderator actions",
		class: className = "",
		children,
	}: PrivilegedActionGroupProps = $props();
</script>

<section
	class={`privileged-action-group ${className}`.trim()}
	aria-label={title}
>
	<header class="privileged-action-group__header">
		<strong>{title}</strong>
		<PrivilegedActionBadge />
	</header>
	<div class="privileged-action-group__content">
		{@render children()}
	</div>
</section>

<style lang="scss">
	@use "./PrivilegedActionGroup.scss";
</style>
