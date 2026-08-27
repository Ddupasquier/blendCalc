<script lang="ts">
	import { enhance } from "$app/forms";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import {
		PROFILE_BIO_MAX_LENGTH,
		PROFILE_DISPLAY_NAME_MAX_LENGTH,
	} from "$lib/utils/profile/profileValidation";
	import type { ProfileDetailsSettingsProps } from "./types";

	let {
		displayName,
		bio,
		errorMessage,
		successMessage,
		onSaveSuccess,
	}: ProfileDetailsSettingsProps = $props();

	let isSaving = $state(false);
	const enhanceProfile = createPendingSubmit(
		(pending) => (isSaving = pending),
		(result) => {
			if (result.type === "success") onSaveSuccess?.();
		},
	);
</script>

<div class="profile-details-settings">
	<p>
		Choose the name you see in the app and add an optional note about yourself.
	</p>
	{#if errorMessage}
		<StatusMessage tone="danger" message={errorMessage} />
	{:else if successMessage}
		<StatusMessage tone="success" message={successMessage} />
	{/if}

	<form
		method="POST"
		action="/profile?/saveProfile"
		use:enhance={enhanceProfile}
		aria-busy={isSaving}
	>
		<TextField
			id="profile-display-name"
			name="displayName"
			label="Preferred name"
			value={displayName}
			maxlength={PROFILE_DISPLAY_NAME_MAX_LENGTH}
			showCharacterCount
			autocomplete="name"
			placeholder="What should we call you?"
			helper="This name stays separate from your private account email."
			disabled={isSaving}
		/>
		<TextField
			id="profile-bio"
			name="bio"
			label="Bio"
			value={bio}
			maxlength={PROFILE_BIO_MAX_LENGTH}
			showCharacterCount
			rows={4}
			placeholder="A short note about you"
			multiline
			disabled={isSaving}
		/>
		<RoundedActionButton type="submit" fullWidth busy={isSaving}>
			Save profile
		</RoundedActionButton>
	</form>
</div>

<style lang="scss">
	@use "./ProfileDetailsSettings.scss";
</style>
