<script lang="ts">
	import { enhance } from "$app/forms";
	import MfaPageShell from "$lib/components/auth/MfaPageShell/MfaPageShell.svelte";
	import AuthenticatorVerificationCodeField from "$lib/components/auth/AuthenticatorVerificationCodeField/AuthenticatorVerificationCodeField.svelte";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import { formatDocumentTitle } from "$lib/config/pageMetadata";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import type { MfaEnrollmentPageProps, MfaEnrollmentSetup } from "./types";

	let { data, form }: MfaEnrollmentPageProps = $props();
	let isSubmitting = $state(false);
	let activeEnrollment = $state<MfaEnrollmentSetup | null>(null);
	const enrollment = $derived(form?.enrollment ?? activeEnrollment);
	const returnPath = $derived(form?.next ?? data.next);
	const preventDuplicateSubmit = createPendingSubmit(
		(pending) => (isSubmitting = pending),
	);

	$effect(() => {
		if (form?.enrollment) activeEnrollment = form.enrollment;
	});
</script>

<svelte:head>
	<title>{formatDocumentTitle("Authenticator Setup")}</title>
</svelte:head>

<MfaPageShell
	eyebrow="Protected access"
	title="Set up your authenticator."
	description="Protected blendCalc tools require a rotating code in addition to your password."
>
	{#if form?.message}
		<StatusMessage tone="danger" message={form.message} />
	{/if}

	{#if enrollment}
		<div class="mfa-enrollment">
			<p class="mfa-enrollment__instructions">
				Scan this code with Google Authenticator or another authenticator app. Use the current six-digit code it creates below.
			</p>
			<div class="mfa-enrollment__qr">
				<img src={enrollment.qrCodeDataUrl} alt="Authenticator setup QR code" />
			</div>
			<div class="mfa-enrollment__secret">
				<span>Can’t scan it? Enter this setup key</span>
				<code>{enrollment.secret}</code>
			</div>
			<form
				class="mfa-form"
				method="POST"
				action="?/verifyEnrollment"
				use:enhance={preventDuplicateSubmit}
			>
				<input type="hidden" name="next" value={returnPath} />
				<input type="hidden" name="factorId" value={enrollment.factorId} />
				<AuthenticatorVerificationCodeField
					disabled={isSubmitting}
					invalid={Boolean(form?.message)}
				/>
				<ActionButton type="submit" busy={isSubmitting} fullWidth>
					Finish setup
				</ActionButton>
			</form>
		</div>
	{:else}
		<div class="mfa-enrollment">
			<StatusMessage
				tone="info"
				title="Before you begin"
				message="Have an authenticator app ready. Setup stays private and the QR code is shown only during this step."
			/>
			<form method="POST" action="?/beginEnrollment" use:enhance={preventDuplicateSubmit}>
				<input type="hidden" name="next" value={returnPath} />
				<ActionButton type="submit" busy={isSubmitting} fullWidth>
					Start setup
				</ActionButton>
			</form>
		</div>
	{/if}
</MfaPageShell>

<style lang="scss">
	@use "./page.scss";
</style>
