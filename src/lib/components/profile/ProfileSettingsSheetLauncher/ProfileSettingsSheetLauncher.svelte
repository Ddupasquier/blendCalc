<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import type { ProfileSettingsSheetLauncherProps } from "./types";

	let {
		title,
		description,
		controls,
		icon,
		onOpen,
	}: ProfileSettingsSheetLauncherProps = $props();
</script>

<button
	class="profile-settings-sheet-launcher"
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
	<Chevron class="profile-settings-sheet-launcher__chevron" direction="right" />
</button>

<style lang="scss">
	@use "./ProfileSettingsSheetLauncher.scss";
</style>
