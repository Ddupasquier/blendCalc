<script lang="ts">
	import RoundedActionLink from "$lib/components/common/buttons/RoundedActionLink/RoundedActionLink.svelte";
	import ProfileSettingsSection from "$lib/components/profile/ProfileSettingsSection/ProfileSettingsSection.svelte";
</script>

<ProfileSettingsSection
	title="Help &amp; tutorial"
	description="Replay the guided tour whenever you want a refresher."
>
	<RoundedActionLink href="/profile/tutorial">Open guided tutorial</RoundedActionLink>
</ProfileSettingsSection>

<style lang="scss">
	@use "./ProfileTutorialSettings.scss";
</style>
