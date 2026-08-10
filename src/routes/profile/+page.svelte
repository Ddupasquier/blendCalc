<script lang="ts">
	import {
		pushState,
		replaceState as replaceNavigationState,
	} from "$app/navigation";
	import { page } from "$app/state";
	import type { ActionData, PageData } from "./$types";
	import BottomSheet from "$lib/components/common/sheets/BottomSheet/BottomSheet.svelte";
	import RightSheet from "$lib/components/common/sheets/RightSheet/RightSheet.svelte";
	import ViewHeader from "$lib/components/common/view/ViewHeader/ViewHeader.svelte";
	import ProfileAppearanceSettings from "$lib/components/profile/ProfileAppearanceSettings/ProfileAppearanceSettings.svelte";
	import ProfileDetailsSettings from "$lib/components/profile/ProfileDetailsSettings/ProfileDetailsSettings.svelte";
	import ProfileFoodPreferenceView from "$lib/components/profile/ProfileFoodPreferenceView/ProfileFoodPreferenceView.svelte";
	import ProfileIdentitySummary from "$lib/components/profile/ProfileIdentitySummary/ProfileIdentitySummary.svelte";
	import ProfileImageSettings from "$lib/components/profile/ProfileImageSettings/ProfileImageSettings.svelte";
	import ProfileSettingsMenu from "$lib/components/profile/ProfileSettingsMenu/ProfileSettingsMenu.svelte";
	import ProfileSessionSettings from "$lib/components/profile/ProfileSessionSettings/ProfileSessionSettings.svelte";
	import ProfileTutorialSettings from "$lib/components/profile/ProfileTutorialSettings/ProfileTutorialSettings.svelte";
	import { APP_NAME } from "$lib/config/brand";
	import { getAppDocumentTitle } from "$lib/config/pageMetadata";
	import {
		getProfileSettingsRoute,
		getProfileSettingsRouteHref,
		PROFILE_SETTINGS_ROUTES,
		type ProfileSettingsRoute,
	} from "$lib/utils/profile/profileRouteState";
	import { normalizeThemePreference } from "$lib/utils/theme/themePreference";

	const data = $derived(page.data as PageData);
	const form = $derived(page.form as ActionData | null);
	let activeSettingsRoute = $state<ProfileSettingsRoute | null>(
		getProfileSettingsRoute(page.url.pathname),
	);
	const documentTitle = $derived(getAppDocumentTitle(page.url));

	$effect(() => {
		activeSettingsRoute = getProfileSettingsRoute(page.url.pathname);
	});

	const displayName = $derived(
		form?.profileValues?.displayName ??
		data.profile?.display_name ??
		data.defaultDisplayName,
	);
	const bio = $derived(form?.profileValues?.bio ?? data.profile?.bio ?? "");
	const appearanceTheme = $derived(
		normalizeThemePreference(form?.appearanceTheme ?? data.profile?.appearance_theme),
	);

	const openSettingsRoute = (settingsRoute: ProfileSettingsRoute) => {
		if (activeSettingsRoute === settingsRoute) return;
		activeSettingsRoute = settingsRoute;
		pushState(getProfileSettingsRouteHref(settingsRoute), { ...page.state });
	};

	const closeSettingsRoute = () => {
		if (!activeSettingsRoute) return;
		activeSettingsRoute = null;
		replaceNavigationState("/profile", { ...page.state });
	};
</script>

<svelte:head>
	<title>{documentTitle}</title>
	<meta
		name="description"
		content={`Manage your identity, food preferences, appearance, and ${APP_NAME} account.`}
	/>
</svelte:head>

<BottomSheet
	id="profile-appearance-sheet"
	open={activeSettingsRoute === PROFILE_SETTINGS_ROUTES.appearance}
	title="Appearance"
	titleId="profile-appearance-sheet-title"
	backLabel="Close appearance settings"
	onClose={closeSettingsRoute}
>
	<ProfileAppearanceSettings
		initialTheme={appearanceTheme}
		errorMessage={form?.appearanceError}
		successMessage={form?.appearanceSuccess}
		onSaveSuccess={closeSettingsRoute}
	/>
</BottomSheet>

<BottomSheet
	id="profile-details-sheet"
	open={activeSettingsRoute === PROFILE_SETTINGS_ROUTES.details}
	title="Profile details"
	titleId="profile-details-sheet-title"
	backLabel="Close profile details"
	onClose={closeSettingsRoute}
>
	<ProfileDetailsSettings
		{displayName}
		{bio}
		errorMessage={form?.profileError}
		successMessage={form?.profileSuccess}
		onSaveSuccess={closeSettingsRoute}
	/>
</BottomSheet>

<BottomSheet
	id="profile-image-sheet"
	open={activeSettingsRoute === PROFILE_SETTINGS_ROUTES.image}
	title="Profile image"
	titleId="profile-image-sheet-title"
	backLabel="Close profile image settings"
	fill
	onClose={closeSettingsRoute}
>
	<ProfileImageSettings
		currentAltText={data.profile?.avatar_alt_text}
		hasCurrentImage={Boolean(data.profile?.avatar_path)}
		policyItems={data.avatarPolicyItems}
		requireHumanFace={data.requireHumanFace}
		errorMessage={form?.avatarError}
		successMessage={form?.avatarSuccess}
		onSaveSuccess={closeSettingsRoute}
	/>
</BottomSheet>

<RightSheet
	id="profile-food-preferences-view"
	open={activeSettingsRoute === PROFILE_SETTINGS_ROUTES.foodPreferences}
	labelledby="profile-food-preferences-view-title"
	onClose={closeSettingsRoute}
>
	<ProfileFoodPreferenceView
		foodPreferences={data.foodPreferences}
		foodPreferencesUnavailable={data.foodPreferencesUnavailable}
		foodPreferenceOptions={data.foodPreferenceOptions}
		priorityNutrientOptions={data.priorityNutrientOptions}
		regulatoryRegionOptions={data.regulatoryRegionOptions}
		submittedValues={form?.foodPreferenceValues}
		errorMessage={form?.foodPreferencesError}
		successMessage={form?.foodPreferencesSuccess}
		onClose={closeSettingsRoute}
	/>
</RightSheet>

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

	<ProfileSettingsMenu
		{appearanceTheme}
		{displayName}
		{bio}
		hasProfileImage={Boolean(data.profile?.avatar_path)}
		allergenCount={data.foodPreferences?.allergens.length ?? 0}
		dietaryRestrictionCount={data.foodPreferences?.dietaryRestrictions.length ?? 0}
		priorityNutrientCount={data.foodPreferences?.prioritizedNutrientIds.length ?? 0}
		onOpen={openSettingsRoute}
	/>

	<ProfileTutorialSettings />
	<ProfileSessionSettings />
</div>

<style lang="scss">
	@use "./page.scss";
</style>
