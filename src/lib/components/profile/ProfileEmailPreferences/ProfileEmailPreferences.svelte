<script lang="ts">
	import { enhance } from "$app/forms";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import ToggleSwitch from "$lib/components/common/forms/ToggleSwitch/ToggleSwitch.svelte";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import {
		getDefaultMarketingEmailPreferenceValues,
		getMarketingEmailPreferenceValues,
		type MarketingEmailPreferenceValues,
		type MarketingEmailTopicKey,
	} from "$lib/utils/email/marketingEmailPreferences";
	import type { ProfileEmailPreferencesProps } from "./types";

	let {
		preferences,
		submittedValues,
		errorMessage,
		successMessage,
		onSaveSuccess,
	}: ProfileEmailPreferencesProps = $props();

	let values = $state<MarketingEmailPreferenceValues>(
		getDefaultMarketingEmailPreferenceValues(),
	);
	let previousInitialValues = $state("");
	let isSaving = $state(false);

	$effect(() => {
		const nextValues =
			submittedValues ?? getMarketingEmailPreferenceValues(preferences);
		const serialized = JSON.stringify(nextValues);
		if (serialized === previousInitialValues) return;
		previousInitialValues = serialized;
		values = { ...nextValues };
	});

	const setTopic = (topicKey: MarketingEmailTopicKey, checked: boolean) => {
		values = { ...values, [topicKey]: checked };
	};

	const turnOffAll = () => {
		values = Object.fromEntries(
			Object.keys(values).map((topicKey) => [topicKey, false]),
		) as MarketingEmailPreferenceValues;
	};

	const enhancePreferences = createPendingSubmit(
		(pending) => (isSaving = pending),
		(result) => {
			if (result.type === "success") onSaveSuccess?.();
		},
	);
</script>

<div class="profile-email-preferences">
	<p>
		Choose the optional emails you want. New categories always start off until
		you turn them on.
	</p>

	{#if errorMessage}
		<StatusMessage tone="danger" message={errorMessage} />
	{:else if successMessage}
		<StatusMessage tone="success" message={successMessage} />
	{/if}

	<form
		method="POST"
		action="/profile?/saveEmailPreferences"
		use:enhance={enhancePreferences}
		aria-busy={isSaving}
	>
		<div class="profile-email-preferences__topics">
			{#each preferences as preference (preference.topicKey)}
				<input
					type="hidden"
					name={preference.topicKey}
					value={values[preference.topicKey] ? "true" : "false"}
				/>
				<label
					class="profile-email-preferences__toggle"
					for={`marketing-email-${preference.topicKey}`}
				>
					<span>
						<strong>{preference.label}</strong>
						<small>{preference.description}</small>
					</span>
					<ToggleSwitch
						id={`marketing-email-${preference.topicKey}`}
						checked={values[preference.topicKey]}
						disabled={isSaving}
						ariaLabel={preference.label}
						onChange={(checked) => setTopic(preference.topicKey, checked)}
					/>
				</label>
			{/each}
		</div>

		<div class="profile-email-preferences__actions">
			<RoundedActionButton type="submit" fullWidth busy={isSaving}>
				Save email preferences
			</RoundedActionButton>
			<RoundedActionButton
				type="button"
				variant="neutral"
				fullWidth
				disabled={isSaving || Object.values(values).every((value) => !value)}
				onclick={turnOffAll}
			>
				Turn off all promotional email
			</RoundedActionButton>
		</div>
	</form>

	<p class="profile-email-preferences__service-note">
		Account confirmation, password, security, and required service messages are
		not promotional and are unaffected by these choices.
	</p>
</div>

<style lang="scss">
	@use "./ProfileEmailPreferences.scss";
</style>
