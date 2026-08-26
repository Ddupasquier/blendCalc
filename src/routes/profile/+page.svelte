<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import type { ActionData, PageData } from "./$types";
	import BottomSheet from "$lib/components/common/sheets/BottomSheet/BottomSheet.svelte";
	import RightSheet from "$lib/components/common/sheets/RightSheet/RightSheet.svelte";
	import ViewBody from "$lib/components/common/view/ViewBody/ViewBody.svelte";
	import ViewFrame from "$lib/components/common/view/ViewFrame/ViewFrame.svelte";
	import ViewHeader from "$lib/components/common/view/ViewHeader/ViewHeader.svelte";
	import ViewTop from "$lib/components/common/view/ViewTop/ViewTop.svelte";
	import ProfileAppearanceSettings from "$lib/components/profile/ProfileAppearanceSettings/ProfileAppearanceSettings.svelte";
	import ProfilePlayfulMessageSettings from "$lib/components/profile/ProfilePlayfulMessageSettings/ProfilePlayfulMessageSettings.svelte";
	import ProfileDetailsSettings from "$lib/components/profile/ProfileDetailsSettings/ProfileDetailsSettings.svelte";
	import ProfileFoodPreferenceView from "$lib/components/profile/ProfileFoodPreferenceView/ProfileFoodPreferenceView.svelte";
	import ProfileIdentitySummary from "$lib/components/profile/ProfileIdentitySummary/ProfileIdentitySummary.svelte";
	import ProfileImageSettings from "$lib/components/profile/ProfileImageSettings/ProfileImageSettings.svelte";
	import ProfilePrivilegedToolsLauncher from "$lib/components/profile/ProfilePrivilegedToolsLauncher/ProfilePrivilegedToolsLauncher.svelte";
	import ProfilePrivilegedToolsSheet from "$lib/components/profile/ProfilePrivilegedToolsSheet/ProfilePrivilegedToolsSheet.svelte";
	import ProfileSettingsMenu from "$lib/components/profile/ProfileSettingsMenu/ProfileSettingsMenu.svelte";
	import ProfileSessionSettings from "$lib/components/profile/ProfileSessionSettings/ProfileSessionSettings.svelte";
	import ProfileTutorialSettings from "$lib/components/profile/ProfileTutorialSettings/ProfileTutorialSettings.svelte";
	import { APP_NAME } from "$lib/config/brand";
	import { formatDocumentTitle } from "$lib/config/pageMetadata";
	import {
		getProfileSettingsRoute,
		getProfileSettingsRouteHref,
		getProfileSettingsRouteTitle,
		PROFILE_SETTINGS_ROUTES,
		type ProfileSettingsRoute,
	} from "$lib/utils/profile/profileRouteState";
	import { createScrollAwareHeaderVisibilityController } from "$lib/utils/navigation/scrollAwareHeaderVisibilityController.svelte";
	import { navigateShallowRoute } from "$lib/utils/navigation/shallowRouteNavigation";
	import {
		getActiveShallowRouteUrl,
		SHALLOW_ROUTE_PAGE_STATE_KEYS,
	} from "$lib/utils/navigation/shallowRouteState";
	import { normalizeThemePreference } from "$lib/utils/theme/themePreference";

	const data = $derived(page.data as PageData);
	const form = $derived(page.form as ActionData | null);
	const activeProfileRouteUrl = $derived(
		getActiveShallowRouteUrl(page.url, page.state.profileRouteHref),
	);
	const activeSettingsRoute = $derived<ProfileSettingsRoute | null>(
		getProfileSettingsRoute(activeProfileRouteUrl.pathname),
	);
	let profileScrollContainer = $state<HTMLElement | null>(null);
	const headerVisibility = createScrollAwareHeaderVisibilityController({
		isEnabled: () => activeSettingsRoute === null,
	});
	const documentTitle = $derived(
		formatDocumentTitle(
			activeSettingsRoute
				? getProfileSettingsRouteTitle(
						getProfileSettingsRouteHref(activeSettingsRoute),
					)
				: "Profile",
		),
	);

	$effect(() => headerVisibility.observe(profileScrollContainer));

	const displayName = $derived(
		form?.profileValues?.displayName ??
			data.profile?.display_name ??
			data.defaultDisplayName,
	);
	const bio = $derived(form?.profileValues?.bio ?? data.profile?.bio ?? "");
	const appearanceTheme = $derived(
		normalizeThemePreference(
			form?.appearanceTheme ?? data.profile?.appearance_theme,
		),
	);
	const playfulMessagesEnabled = $derived(
		form?.playfulMessagesEnabled ??
			data.profile?.cheeky_messages_enabled ??
			true,
	);
	const savedFoodSafetyPreferenceCount = $derived(
		(data.foodPreferences?.allergens.length ?? 0) +
			(data.foodPreferences?.dietaryRestrictions.length ?? 0),
	);
	const pendingFoodPreferenceCount = $derived(
		(data.foodPreferences?.preferenceResolutions ?? []).filter(
			(resolution) => resolution.status === "unresolved",
		).length,
	);
	const activeFoodPreferenceCount = $derived(
		Math.max(0, savedFoodSafetyPreferenceCount - pendingFoodPreferenceCount),
	);

	const openSettingsRoute = (settingsRoute: ProfileSettingsRoute) => {
		if (activeSettingsRoute === settingsRoute) return;
		const href = getProfileSettingsRouteHref(settingsRoute);
		navigateShallowRoute({
			href,
			pageState: page.state,
			routeStateKey: SHALLOW_ROUTE_PAGE_STATE_KEYS.profile,
		});
	};

	const closeSettingsRoute = () => {
		const href = "/profile";
		navigateShallowRoute({
			href,
			pageState: page.state,
			routeStateKey: SHALLOW_ROUTE_PAGE_STATE_KEYS.profile,
			replace: true,
		});
	};

	const closeSettingsRouteAfterSave = () => {
		void goto("/profile", {
			keepFocus: true,
			noScroll: true,
			replaceState: true,
		});
	};

	const navigateToModeratorDestination = (href: string) => {
		void goto(href);
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
	title="Light/Dark Mode"
	titleId="profile-appearance-sheet-title"
	onClose={closeSettingsRoute}
>
	<ProfileAppearanceSettings
		initialTheme={appearanceTheme}
		errorMessage={form?.appearanceError}
		successMessage={form?.appearanceSuccess}
		onSaveSuccess={closeSettingsRouteAfterSave}
	/>
</BottomSheet>

<BottomSheet
	id="profile-playful-messages-sheet"
	open={activeSettingsRoute === PROFILE_SETTINGS_ROUTES.playfulMessages}
	title="Playful messages"
	titleId="profile-playful-messages-sheet-title"
	onClose={closeSettingsRoute}
>
	<ProfilePlayfulMessageSettings
		initiallyEnabled={playfulMessagesEnabled}
		errorMessage={form?.playfulMessagesError}
		successMessage={form?.playfulMessagesSuccess}
		onSaveSuccess={closeSettingsRouteAfterSave}
	/>
</BottomSheet>

<BottomSheet
	id="profile-details-sheet"
	open={activeSettingsRoute === PROFILE_SETTINGS_ROUTES.details}
	title="Profile details"
	titleId="profile-details-sheet-title"
	onClose={closeSettingsRoute}
>
	<ProfileDetailsSettings
		{displayName}
		{bio}
		errorMessage={form?.profileError}
		successMessage={form?.profileSuccess}
		onSaveSuccess={closeSettingsRouteAfterSave}
	/>
</BottomSheet>

<BottomSheet
	id="profile-image-sheet"
	open={activeSettingsRoute === PROFILE_SETTINGS_ROUTES.image}
	title="Profile image"
	titleId="profile-image-sheet-title"
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
		onSaveSuccess={closeSettingsRouteAfterSave}
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
		foodPreferenceOptionsUnavailable={data.foodPreferenceOptionsUnavailable}
		priorityNutrientOptions={data.priorityNutrientOptions}
		regulatoryRegionOptions={data.regulatoryRegionOptions}
		submittedValues={form?.foodPreferenceValues}
		errorMessage={form?.foodPreferencesError}
		successMessage={form?.foodPreferencesSuccess}
		onClose={closeSettingsRoute}
		onSaveSuccess={closeSettingsRouteAfterSave}
	/>
</RightSheet>

{#if data.privilegedToolAccess}
	<ProfilePrivilegedToolsSheet
		open={activeSettingsRoute === PROFILE_SETTINGS_ROUTES.privilegedTools}
		access={data.privilegedToolAccess}
		onClose={closeSettingsRoute}
		onNavigate={navigateToModeratorDestination}
	/>
{/if}

<ViewFrame appShell>
	<ViewTop
		className="profile-page__top"
		compactHidden={headerVisibility.state.hidden}
	>
		<ViewHeader
			title="Your profile"
			subtitle="Manage your identity, food preferences, appearance, and account."
		/>
	</ViewTop>

	<ViewBody>
		<div
			class="profile-page"
			bind:this={profileScrollContainer}
			onscroll={headerVisibility.handleScroll}
		>
			<ProfileIdentitySummary
				avatarUrl={data.avatarUrl}
				avatarAltText={data.profile?.avatar_alt_text}
				displayName={data.profile?.display_name ?? data.defaultDisplayName}
			/>

			<ProfileSettingsMenu
				{appearanceTheme}
				{playfulMessagesEnabled}
				{displayName}
				{bio}
				hasProfileImage={Boolean(data.profile?.avatar_path)}
				{activeFoodPreferenceCount}
				{pendingFoodPreferenceCount}
				priorityNutrientCount={data.foodPreferences?.prioritizedNutrientIds
					.length ?? 0}
				onOpen={openSettingsRoute}
			/>

			{#if data.privilegedToolAccess}
				<ProfilePrivilegedToolsLauncher
					access={data.privilegedToolAccess}
					onOpen={() =>
						openSettingsRoute(PROFILE_SETTINGS_ROUTES.privilegedTools)}
				/>
			{/if}

			<ProfileTutorialSettings />
			<ProfileSessionSettings />
		</div>
	</ViewBody>
</ViewFrame>

<style lang="scss">
	@use "./page.scss";
</style>
