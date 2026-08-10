<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
	import ActionRequiredCountBadge from "$lib/components/common/badges/ActionRequiredCountBadge/ActionRequiredCountBadge.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import type { ProfileSettingsSheetLauncherProps } from "./types";

	let {
		title,
		description,
		controls,
		actionRequiredCount = 0,
		actionRequiredLabel = "actions requiring review",
		variant = "default",
		icon,
		onOpen,
	}: ProfileSettingsSheetLauncherProps = $props();
</script>

<button
	class="profile-settings-sheet-launcher"
	class:profile-settings-sheet-launcher--has-count={actionRequiredCount > 0}
	class:profile-settings-sheet-launcher--privileged={variant === "privileged"}
	type="button"
	aria-haspopup="dialog"
	aria-controls={controls}
	onclick={onOpen}
>
	<CircularIconFrame class="profile-settings-sheet-launcher__icon" decorative>
		{@render icon()}
	</CircularIconFrame>
	<span class="profile-settings-sheet-launcher__copy">
		<strong>{title}</strong>
		<span>{description}</span>
	</span>
	{#if actionRequiredCount > 0}
		<ActionRequiredCountBadge
			count={actionRequiredCount}
			label={actionRequiredLabel}
		/>
	{/if}
	<Chevron class="profile-settings-sheet-launcher__chevron" direction="right" />
</button>

<style lang="scss">
	@use "./ProfileSettingsSheetLauncher.scss";
</style>
