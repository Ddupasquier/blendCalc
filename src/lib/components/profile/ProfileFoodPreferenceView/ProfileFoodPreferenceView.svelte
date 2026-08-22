<script lang="ts">
	import BackButton from "$lib/components/common/buttons/BackButton/BackButton.svelte";
	import ViewBody from "$lib/components/common/view/ViewBody/ViewBody.svelte";
	import ViewFrame from "$lib/components/common/view/ViewFrame/ViewFrame.svelte";
	import ViewHeader from "$lib/components/common/view/ViewHeader/ViewHeader.svelte";
	import ViewTop from "$lib/components/common/view/ViewTop/ViewTop.svelte";
	import ProfileFoodPreferenceSettings from "$lib/components/profile/ProfileFoodPreferenceSettings/ProfileFoodPreferenceSettings.svelte";
	import type { ProfileFoodPreferenceViewProps } from "./types";

	let {
		onClose,
		onSaveSuccess,
		...foodPreferenceSettingsProps
	}: ProfileFoodPreferenceViewProps = $props();
</script>

<ViewFrame className="profile-food-preference-view">
	<ViewTop>
		<div class="profile-food-preference-view__header">
			<BackButton
				class="profile-food-preference-view__back"
				label="Back to profile"
				variant="ghost"
				size="small"
				onclick={onClose}
			/>
			<ViewHeader
				title="Food preferences"
				titleId="profile-food-preferences-view-title"
				subtitle="Fine-tune warnings, serving defaults, and Mix guidance."
			/>
		</div>
	</ViewTop>

	<ViewBody className="profile-food-preference-view__body" scroll>
		<ProfileFoodPreferenceSettings
			{...foodPreferenceSettingsProps}
			{onSaveSuccess}
		/>
	</ViewBody>
</ViewFrame>

<style lang="scss">
	@use "./ProfileFoodPreferenceView.scss";
</style>
