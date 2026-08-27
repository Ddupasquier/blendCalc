<script lang="ts">
	import RoundedActionLink from "$lib/components/common/buttons/RoundedActionLink/RoundedActionLink.svelte";
	import ProfileSettingsSection from "$lib/components/profile/ProfileSettingsSection/ProfileSettingsSection.svelte";
</script>

<ProfileSettingsSection
	title="Help &amp; tutorial"
	description="Replay the guided tour whenever you want a refresher."
>
	<div class="profile-tutorial-settings__action">
		<RoundedActionLink href="/profile/tutorial"
			>Open guided tutorial</RoundedActionLink
		>
	</div>
</ProfileSettingsSection>

<style lang="scss">
	@use "./ProfileTutorialSettings.scss";
</style>
