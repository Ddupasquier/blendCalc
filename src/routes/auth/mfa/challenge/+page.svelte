<script lang="ts">
	import { enhance } from "$app/forms";
	import MfaPageShell from "$lib/components/auth/MfaPageShell/MfaPageShell.svelte";
	import AuthenticatorVerificationCodeField from "$lib/components/auth/AuthenticatorVerificationCodeField/AuthenticatorVerificationCodeField.svelte";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import RoundedActionLink from "$lib/components/common/buttons/RoundedActionLink/RoundedActionLink.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import { formatDocumentTitle } from "$lib/config/pageMetadata";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import type { MfaChallengePageProps } from "./types";

	let { data, form }: MfaChallengePageProps = $props();
	let isSubmitting = $state(false);
	const returnPath = $derived(form?.next ?? data.next);
	const preventDuplicateSubmit = createPendingSubmit(
		(pending) => (isSubmitting = pending),
	);
</script>

<svelte:head>
	<title>{formatDocumentTitle("Security Verification")}</title>
</svelte:head>

<MfaPageShell
	eyebrow="Protected access"
	title="Confirm it’s you."
	description="Enter the current code from your authenticator app to continue to protected blendCalc tools."
>
	{#if form?.message}
		<StatusMessage tone="danger" message={form.message} />
	{/if}
	<form class="mfa-form" method="POST" use:enhance={preventDuplicateSubmit}>
		<input type="hidden" name="next" value={returnPath} />
		<input type="hidden" name="factorId" value={data.factorId} />
		<AuthenticatorVerificationCodeField
			disabled={isSubmitting}
			invalid={Boolean(form?.message)}
		/>
		{#if data.factorName}
			<p class="mfa-form__help">Using {data.factorName}</p>
		{/if}
		<ActionButton type="submit" busy={isSubmitting} fullWidth>
			Verify and continue
		</ActionButton>
		<RoundedActionLink
			href={`/auth/mfa/recovery?next=${encodeURIComponent(returnPath)}`}
			variant="neutral"
			fullWidth
		>
			I can’t use my authenticator
		</RoundedActionLink>
	</form>
</MfaPageShell>

<style lang="scss">
	@use "./page.scss";
</style>
