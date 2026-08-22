<script lang="ts">
	import { enhance } from "$app/forms";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import ToggleSwitch from "$lib/components/common/forms/ToggleSwitch/ToggleSwitch.svelte";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import type { ProfilePlayfulMessageSettingsProps } from "./types";

	let {
		initiallyEnabled,
		errorMessage,
		successMessage,
		onSaveSuccess,
	}: ProfilePlayfulMessageSettingsProps = $props();

	let enabled = $state(false);
	let previousInitialValue = $state<boolean | null>(null);
	let isSaving = $state(false);

	$effect(() => {
		if (initiallyEnabled === previousInitialValue) return;
		previousInitialValue = initiallyEnabled;
		enabled = initiallyEnabled;
	});

	const enhancePreference = createPendingSubmit(
		(pending) => (isSaving = pending),
		(result) => {
			if (result.type === "success") onSaveSuccess?.();
		},
	);
</script>

<div class="profile-playful-message-settings">
	<p>
		Show an occasional playful food joke after successful, non-safety actions.
		This is on by default and never appears in warnings, recalls, health guidance,
		authentication, or errors.
	</p>
	{#if errorMessage}
		<StatusMessage tone="danger" message={errorMessage} />
	{:else if successMessage}
		<StatusMessage tone="success" message={successMessage} />
	{/if}

	<form
		method="POST"
		action="/profile?/savePlayfulMessages"
		use:enhance={enhancePreference}
		aria-busy={isSaving}
	>
		<input type="hidden" name="playfulMessagesEnabled" value={enabled ? "true" : "false"} />
		<label class="profile-playful-message-settings__toggle" for="playful-messages-enabled">
			<span>
				<strong>Playful messages</strong>
				<small>{enabled ? "On" : "Off"}</small>
			</span>
			<ToggleSwitch
				id="playful-messages-enabled"
				name="playfulMessagesToggle"
				checked={enabled}
				disabled={isSaving}
				ariaLabel="Allow playful messages"
				onChange={(checked) => (enabled = checked)}
			/>
		</label>
		<RoundedActionButton type="submit" busy={isSaving}>
			Save playful messages
		</RoundedActionButton>
	</form>
</div>

<style lang="scss">
	@use "./ProfilePlayfulMessageSettings.scss";
</style>
