<script lang="ts">
	import type { ProfileSettingsSectionProps } from "./types";

	let {
		title,
		description,
		tutorialTarget,
		children,
	}: ProfileSettingsSectionProps = $props();
</script>

<section class="profile-settings-section" data-tutorial-target={tutorialTarget}>
	<header class="profile-settings-section__header">
		<h2>{title}</h2>
		<p>{description}</p>
	</header>
	<div class="profile-settings-section__content">
		{@render children()}
	</div>
</section>

<style lang="scss">
	@use "./ProfileSettingsSection.scss";
</style>
