<script lang="ts">
	import ViewHeader from "$lib/components/common/view/ViewHeader/ViewHeader.svelte";
	import ProfileAppearanceSettings from "$lib/components/profile/ProfileAppearanceSettings/ProfileAppearanceSettings.svelte";
	import ProfileDetailsSettings from "$lib/components/profile/ProfileDetailsSettings/ProfileDetailsSettings.svelte";
	import ProfileFoodPreferenceSettings from "$lib/components/profile/ProfileFoodPreferenceSettings/ProfileFoodPreferenceSettings.svelte";
	import ProfileIdentitySummary from "$lib/components/profile/ProfileIdentitySummary/ProfileIdentitySummary.svelte";
	import ProfileImageSettings from "$lib/components/profile/ProfileImageSettings/ProfileImageSettings.svelte";
	import ProfileSessionSettings from "$lib/components/profile/ProfileSessionSettings/ProfileSessionSettings.svelte";
	import ProfileTutorialSettings from "$lib/components/profile/ProfileTutorialSettings/ProfileTutorialSettings.svelte";
	import { APP_NAME } from "$lib/config/brand";
	import { formatDocumentTitle } from "$lib/config/pageMetadata";
	import { normalizeThemePreference } from "$lib/utils/theme/themePreference";
	import type { ProfilePageProps } from "./types";

	let { data, form }: ProfilePageProps = $props();

	const displayName = $derived(
		form?.profileValues?.displayName ??
		data.profile?.display_name ??
		data.defaultDisplayName,
	);
	const bio = $derived(form?.profileValues?.bio ?? data.profile?.bio ?? "");
	const appearanceTheme = $derived(
		normalizeThemePreference(form?.appearanceTheme ?? data.profile?.appearance_theme),
	);
</script>

<svelte:head>
	<title>{formatDocumentTitle("Profile")}</title>
	<meta
		name="description"
		content={`Manage your identity, food preferences, appearance, and ${APP_NAME} account.`}
	/>
</svelte:head>

<div class="profile-page">
	<ViewHeader
		title="Your profile"
		subtitle="Manage your identity, food preferences, appearance, and account."
	/>

	<ProfileIdentitySummary
		avatarUrl={data.avatarUrl}
		avatarAltText={data.profile?.avatar_alt_text}
		displayName={data.profile?.display_name ?? data.defaultDisplayName}
	/>

	<ProfileAppearanceSettings
		initialTheme={appearanceTheme}
		errorMessage={form?.appearanceError}
		successMessage={form?.appearanceSuccess}
	/>

	<ProfileDetailsSettings
		{displayName}
		{bio}
		errorMessage={form?.profileError}
		successMessage={form?.profileSuccess}
	/>

	<ProfileImageSettings
		currentAltText={data.profile?.avatar_alt_text}
		hasCurrentImage={Boolean(data.profile?.avatar_path)}
		policyItems={data.avatarPolicyItems}
		requireHumanFace={data.requireHumanFace}
		errorMessage={form?.avatarError}
		successMessage={form?.avatarSuccess}
	/>

	<ProfileFoodPreferenceSettings
		foodPreferences={data.foodPreferences}
		foodPreferencesUnavailable={data.foodPreferencesUnavailable}
		foodPreferenceOptions={data.foodPreferenceOptions}
		priorityNutrientOptions={data.priorityNutrientOptions}
		regulatoryRegionOptions={data.regulatoryRegionOptions}
		submittedValues={form?.foodPreferenceValues}
		errorMessage={form?.foodPreferencesError}
		successMessage={form?.foodPreferencesSuccess}
	/>

	<ProfileTutorialSettings />
	<ProfileSessionSettings />
</div>

<style lang="scss">
	@use "./page.scss";
</style>
