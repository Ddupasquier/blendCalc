<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
	import ActionRequiredCountBadge from "$lib/components/common/badges/ActionRequiredCountBadge/ActionRequiredCountBadge.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import type { ProfilePrivilegedToolLinkProps } from "./types";

	let {
		href,
		label,
		description,
		actionRequiredCount = 0,
		actionRequiredLabel = "actions requiring review",
		icon,
	}: ProfilePrivilegedToolLinkProps = $props();
</script>

<a
	{href}
	class="profile-privileged-tool-link"
	class:profile-privileged-tool-link--has-count={actionRequiredCount > 0}
>
	<CircularIconFrame class="profile-privileged-tool-link__icon" decorative>
		{@render icon()}
	</CircularIconFrame>
	<span class="profile-privileged-tool-link__copy">
		<strong>{label}</strong>
		<span>{description}</span>
	</span>
	{#if actionRequiredCount > 0}
		<ActionRequiredCountBadge
			count={actionRequiredCount}
			label={actionRequiredLabel}
		/>
	{/if}
	<Chevron class="profile-privileged-tool-link__chevron" direction="right" />
</a>

<style lang="scss">
	@use "./ProfilePrivilegedToolLink.scss";
</style>
