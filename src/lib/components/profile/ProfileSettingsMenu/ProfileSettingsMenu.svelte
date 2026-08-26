<script lang="ts">
	import Leaf from "$lib/assets/icons/Leaf/Leaf.svelte";
	import Bolt from "$lib/assets/icons/Bolt/Bolt.svelte";
	import Pencil from "$lib/assets/icons/Pencil/Pencil.svelte";
	import Sliders from "$lib/assets/icons/Sliders/Sliders.svelte";
	import User from "$lib/assets/icons/User/User.svelte";
	import ProfileSettingsSection from "$lib/components/profile/ProfileSettingsSection/ProfileSettingsSection.svelte";
	import ProfileSettingsSheetLauncher from "$lib/components/profile/ProfileSettingsSheetLauncher/ProfileSettingsSheetLauncher.svelte";
	import { PROFILE_SETTINGS_ROUTES } from "$lib/utils/profile/profileRouteState";
	import type { ProfileSettingsMenuProps } from "./types";

	let {
		appearanceTheme,
		playfulMessagesEnabled,
		displayName,
		bio,
		hasProfileImage,
		activeFoodPreferenceCount,
		pendingFoodPreferenceCount,
		priorityNutrientCount,
		onOpen,
	}: ProfileSettingsMenuProps = $props();

	const appearanceDescription = $derived(
		appearanceTheme === "system"
			? "Matches this device"
			: `${appearanceTheme[0].toUpperCase()}${appearanceTheme.slice(1)} theme`,
	);
	const profileDetailsDescription = $derived(
		bio ? `${displayName} · Bio added` : `${displayName} · No bio added`,
	);
	const foodPreferenceDescription = $derived(
		activeFoodPreferenceCount || pendingFoodPreferenceCount
			? [
					`${activeFoodPreferenceCount} active`,
					pendingFoodPreferenceCount
						? `${pendingFoodPreferenceCount} pending`
						: null,
				]
					.filter(Boolean)
					.join(" · ")
			: priorityNutrientCount
				? `${priorityNutrientCount} nutrient priorities`
				: "Optional warnings and Mix guidance",
	);
</script>

<ProfileSettingsSection
	title="Settings"
	description="Personalize your account and the guidance you receive around the app."
>
	<div class="profile-settings-menu">
		<ProfileSettingsSheetLauncher
			title="Light/Dark Mode"
			description={appearanceDescription}
			controls="profile-appearance-sheet"
			onOpen={() => onOpen(PROFILE_SETTINGS_ROUTES.appearance)}
		>
			{#snippet icon()}<Sliders />{/snippet}
		</ProfileSettingsSheetLauncher>
		<ProfileSettingsSheetLauncher
			title="Playful messages"
			description={playfulMessagesEnabled ? "On" : "Off"}
			controls="profile-playful-messages-sheet"
			onOpen={() => onOpen(PROFILE_SETTINGS_ROUTES.playfulMessages)}
		>
			{#snippet icon()}<Bolt />{/snippet}
		</ProfileSettingsSheetLauncher>
		<ProfileSettingsSheetLauncher
			title="Profile details"
			description={profileDetailsDescription}
			controls="profile-details-sheet"
			onOpen={() => onOpen(PROFILE_SETTINGS_ROUTES.details)}
		>
			{#snippet icon()}<Pencil />{/snippet}
		</ProfileSettingsSheetLauncher>
		<ProfileSettingsSheetLauncher
			title="Profile image"
			description={hasProfileImage ? "Image added" : "No image added"}
			controls="profile-image-sheet"
			onOpen={() => onOpen(PROFILE_SETTINGS_ROUTES.image)}
		>
			{#snippet icon()}<User />{/snippet}
		</ProfileSettingsSheetLauncher>
		<ProfileSettingsSheetLauncher
			title="Food preferences"
			description={foodPreferenceDescription}
			controls="profile-food-preferences-view"
			onOpen={() => onOpen(PROFILE_SETTINGS_ROUTES.foodPreferences)}
		>
			{#snippet icon()}<Leaf />{/snippet}
		</ProfileSettingsSheetLauncher>
	</div>
</ProfileSettingsSection>

<style lang="scss">
	@use "./ProfileSettingsMenu.scss";
</style>
