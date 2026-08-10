<script lang="ts">
	import { enhance } from "$app/forms";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import CheckboxField from "$lib/components/common/forms/CheckboxField/CheckboxField.svelte";
	import PhotoUploadInput from "$lib/components/common/forms/PhotoUploadInput/PhotoUploadInput.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import type { ProfileImageSettingsProps } from "./types";

	let {
		currentAltText,
		hasCurrentImage,
		policyItems,
		requireHumanFace,
		errorMessage,
		successMessage,
		onSaveSuccess,
	}: ProfileImageSettingsProps = $props();

	let isSaving = $state(false);
	const enhanceAvatar = createPendingSubmit(
		(pending) => (isSaving = pending),
		(result) => {
			if (result.type === "success") onSaveSuccess?.();
		},
	);
</script>

<div class="profile-image-settings">
	<p>Add a private account image. Use a JPEG, PNG, or WebP file up to 5 MB.</p>
	{#if errorMessage}
		<StatusMessage tone="danger" message={errorMessage} />
	{:else if successMessage}
		<StatusMessage tone="success" message={successMessage} />
	{/if}

	<form
		method="POST"
		action="/profile?/uploadAvatar"
		enctype="multipart/form-data"
		use:enhance={enhanceAvatar}
		aria-busy={isSaving}
	>
		<PhotoUploadInput
			id="profile-avatar"
			name="avatar"
			prompt="Profile photo"
			description="Choose one portrait from this device."
			photoCount={1}
			required
			disabled={isSaving}
		/>

		<TextField
			id="profile-avatar-alt"
			name="avatarAltText"
			label="Image description"
			maxlength={160}
			value={currentAltText ?? ""}
			placeholder="Example: Dylan smiling"
			helper="A short description makes the image more useful to people using assistive technology."
			disabled={isSaving}
		/>

		<div class="profile-image-policy">
			<CollapsibleSection title="Profile image rules" surface="accent">
				<ul>
					{#each policyItems as item}
						<li>{item}</li>
					{/each}
				</ul>
			</CollapsibleSection>

			<CheckboxField
				id="profile-avatar-policy"
				name="avatarPolicyAccepted"
				required
				disabled={isSaving}
			>
				I confirm this image follows the profile image rules. My agreement and upload details will be recorded.
			</CheckboxField>
			{#if requireHumanFace}
				<CheckboxField
					id="profile-avatar-face"
					name="avatarHasHumanFace"
					required
					disabled={isSaving}
				>
					I confirm this image contains a recognizable human face.
				</CheckboxField>
			{/if}
		</div>

		<div class="profile-image-actions">
			<RoundedActionButton type="submit" busy={isSaving}>
				Upload image
			</RoundedActionButton>
			{#if hasCurrentImage}
				<RoundedActionButton
					type="submit"
					variant="neutral"
					formAction="/profile?/removeAvatar"
					formNoValidate
					busy={isSaving}
				>
					Remove image
				</RoundedActionButton>
			{/if}
		</div>
	</form>
</div>

<style lang="scss">
	@use "./ProfileImageSettings.scss";
</style>
