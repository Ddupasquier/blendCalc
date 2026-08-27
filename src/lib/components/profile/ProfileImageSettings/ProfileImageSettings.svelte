<script lang="ts">
	import { enhance } from "$app/forms";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import TwoStepConfirmation from "$lib/components/common/actions/TwoStepConfirmation/TwoStepConfirmation.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import MetadataPill from "$lib/components/common/display/MetadataPill/MetadataPill.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import CheckboxField from "$lib/components/common/forms/CheckboxField/CheckboxField.svelte";
	import PhotoUploadInput from "$lib/components/common/forms/PhotoUploadInput/PhotoUploadInput.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import CircularMediaFrame from "$lib/components/common/images/CircularMediaFrame/CircularMediaFrame.svelte";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import type { ProfileImageSettingsProps } from "./types";

	let {
		currentImageUrl,
		currentAltText,
		submittedAltText,
		hasCurrentImage,
		moderationStatus,
		policyItems,
		requireHumanFace,
		errorMessage,
		successMessage,
		onSaveSuccess,
	}: ProfileImageSettingsProps = $props();

	let isSaving = $state(false);
	let isSavingDescription = $state(false);
	let isRemoving = $state(false);
	let removeImageForm = $state<HTMLFormElement | null>(null);
	const currentImageDescription = $derived(
		submittedAltText ?? currentAltText ?? "",
	);
	const currentImageStatus = $derived(
		moderationStatus === "approved" ? "Reviewed" : "Ready to use",
	);
	const enhanceAvatar = createPendingSubmit(
		(pending) => (isSaving = pending),
		(result) => {
			if (result.type === "success") onSaveSuccess?.();
		},
	);
	const enhanceDescription = createPendingSubmit(
		(pending) => (isSavingDescription = pending),
		(result) => {
			if (result.type === "success") onSaveSuccess?.();
		},
	);
	const enhanceRemoval = createPendingSubmit(
		(pending) => (isRemoving = pending),
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

	{#if hasCurrentImage && currentImageUrl}
		<section
			class="profile-image-settings__current"
			aria-label="Current profile image"
		>
			<div class="profile-image-settings__current-summary">
				<CircularMediaFrame
					class="profile-image-settings__preview"
					label="Current profile image"
				>
					<img
						src={currentImageUrl}
						alt={currentAltText ?? "Your current profile"}
					/>
				</CircularMediaFrame>
				<div>
					<strong>Current image</strong>
					<MetadataPill label={currentImageStatus} tone="success" />
				</div>
			</div>

			<form
				method="POST"
				action="/profile?/saveAvatarDescription"
				use:enhance={enhanceDescription}
				aria-busy={isSavingDescription}
			>
				<TextField
					id="current-profile-avatar-alt"
					name="avatarAltText"
					label="Image description"
					maxlength={160}
					value={currentImageDescription}
					placeholder="Example: Dylan smiling"
					helper="Describe the current image for people using assistive technology."
					disabled={isSavingDescription || isRemoving}
				/>
				<RoundedActionButton
					type="submit"
					variant="neutral"
					fullWidth
					busy={isSavingDescription}
					disabled={isRemoving}
				>
					Save description
				</RoundedActionButton>
			</form>

			<form
				bind:this={removeImageForm}
				method="POST"
				action="/profile?/removeAvatar"
				use:enhance={enhanceRemoval}
				aria-busy={isRemoving}
			>
				<TwoStepConfirmation
					actionLabel="Remove image"
					confirmationLabel="Confirm removal"
					message="Select remove again to permanently remove this profile image."
					messageId="profile-image-removal-confirmation"
					disabled={isRemoving || isSavingDescription}
					onConfirm={() => removeImageForm?.requestSubmit()}
				>
					{#snippet children(confirmation)}
						<RoundedActionButton
							type="button"
							variant="neutral"
							fullWidth
							busy={isRemoving}
							disabled={isSavingDescription}
							aria-describedby={confirmation.armed
								? confirmation.messageId
								: undefined}
							onclick={confirmation.activate}
						>
							{confirmation.label}
						</RoundedActionButton>
					{/snippet}
				</TwoStepConfirmation>
			</form>
		</section>
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
			prompt={hasCurrentImage ? "Replace profile photo" : "Profile photo"}
			description={hasCurrentImage
				? "Choose a new portrait to replace the current image."
				: "Choose one portrait from this device."}
			photoCount={1}
			required
			disabled={isSaving}
		/>

		<TextField
			id="profile-avatar-alt"
			name="avatarAltText"
			label={hasCurrentImage
				? "Description for the new image"
				: "Image description"}
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
				I confirm this image follows the profile image rules. My agreement and
				upload details will be recorded.
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
			<RoundedActionButton type="submit" fullWidth busy={isSaving}>
				{hasCurrentImage ? "Replace image" : "Upload image"}
			</RoundedActionButton>
		</div>
	</form>
</div>

<style lang="scss">
	@use "./ProfileImageSettings.scss";
</style>
