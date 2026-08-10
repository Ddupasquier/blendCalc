<script lang="ts">
	import { enhance } from "$app/forms";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
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
	<p>Choose the name you see in the app and add an optional note about yourself.</p>
	{#if errorMessage}
		<StatusMessage tone="danger" message={errorMessage} />
	{:else if successMessage}
		<StatusMessage tone="success" message={successMessage} />
	{/if}

	<form method="POST" action="/profile?/saveProfile" use:enhance={enhanceProfile} aria-busy={isSaving}>
		<TextField
			id="profile-display-name"
			name="displayName"
			label="Preferred name"
			value={displayName}
			maxlength={80}
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
			maxlength={300}
			rows={4}
			placeholder="A short note about you"
			multiline
			disabled={isSaving}
		/>
		<RoundedActionButton type="submit" busy={isSaving}>
			Save profile
		</RoundedActionButton>
	</form>
</div>

<style lang="scss">
	@use "./ProfileDetailsSettings.scss";
</style>
