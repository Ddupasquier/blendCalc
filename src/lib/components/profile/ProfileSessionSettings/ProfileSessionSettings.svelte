<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import ProfileSettingsSection from "$lib/components/profile/ProfileSettingsSection/ProfileSettingsSection.svelte";

	let isLoggingOut = $state(false);
</script>

<ProfileSettingsSection
	title="Account session"
	description="Log out of this device. Your profile, foods, Mix, and recipes will be here next time."
>
	<form
		method="POST"
		action="/auth/logout"
		aria-busy={isLoggingOut}
		onsubmit={() => (isLoggingOut = true)}
	>
		<RoundedActionButton type="submit" variant="neutral" busy={isLoggingOut}>
			Log out
		</RoundedActionButton>
	</form>
</ProfileSettingsSection>

<style lang="scss">
	@use "./ProfileSessionSettings.scss";
</style>
