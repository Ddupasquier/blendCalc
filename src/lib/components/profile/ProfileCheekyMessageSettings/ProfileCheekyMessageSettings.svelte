<script lang="ts">
	import { enhance } from "$app/forms";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import ToggleSwitch from "$lib/components/common/forms/ToggleSwitch/ToggleSwitch.svelte";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import type { ProfileCheekyMessageSettingsProps } from "./types";

	let {
		initiallyEnabled,
		errorMessage,
		successMessage,
		onSaveSuccess,
	}: ProfileCheekyMessageSettingsProps = $props();

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

<div class="profile-cheeky-message-settings">
	<p>
		Allow an occasional PG-13 food joke after successful, non-safety actions.
		This is off by default and never appears in warnings, recalls, health guidance,
		authentication, or errors.
	</p>
	{#if errorMessage}
		<StatusMessage tone="danger" message={errorMessage} />
	{:else if successMessage}
		<StatusMessage tone="success" message={successMessage} />
	{/if}

	<form
		method="POST"
		action="/profile?/saveCheekyMessages"
		use:enhance={enhancePreference}
		aria-busy={isSaving}
	>
		<label class="profile-cheeky-message-settings__toggle" for="cheeky-messages-enabled">
			<span>
				<strong>Cheeky messages</strong>
				<small>{enabled ? "On" : "Off"}</small>
			</span>
			<ToggleSwitch
				id="cheeky-messages-enabled"
				name="cheekyMessagesEnabled"
				checked={enabled}
				disabled={isSaving}
				ariaLabel="Allow cheeky messages"
				onChange={(checked) => (enabled = checked)}
			/>
		</label>
		<RoundedActionButton type="submit" busy={isSaving}>
			Save message preference
		</RoundedActionButton>
	</form>
</div>

<style lang="scss">
	@use "./ProfileCheekyMessageSettings.scss";
</style>
