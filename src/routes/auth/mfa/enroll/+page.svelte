<script lang="ts">
	import { enhance } from "$app/forms";
	import MfaPageShell from "$lib/components/auth/MfaPageShell/MfaPageShell.svelte";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import { formatDocumentTitle } from "$lib/config/pageMetadata";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import type { MfaEnrollmentPageProps } from "./types";

	let { data, form }: MfaEnrollmentPageProps = $props();
	let isSubmitting = $state(false);
	const preventDuplicateSubmit = createPendingSubmit(
		(pending) => (isSubmitting = pending),
	);
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

	{#if form?.enrollment}
		<div class="mfa-enrollment">
			<p class="mfa-enrollment__instructions">
				Scan this code with your authenticator app, then enter the six-digit code it creates.
			</p>
			<div class="mfa-enrollment__qr">
				<img src={form.enrollment.qrCodeDataUrl} alt="Authenticator setup QR code" />
			</div>
			<div class="mfa-enrollment__secret">
				<span>Can’t scan it? Enter this setup key</span>
				<code>{form.enrollment.secret}</code>
			</div>
			<form
				class="mfa-form"
				method="POST"
				action="?/verifyEnrollment"
				use:enhance={preventDuplicateSubmit}
			>
				<input type="hidden" name="factorId" value={form.enrollment.factorId} />
				<label>
					<span>Six-digit code</span>
					<input
						type="text"
						name="code"
						inputmode="numeric"
						autocomplete="one-time-code"
						pattern="[0-9]{6}"
						maxlength="6"
						required
						disabled={isSubmitting}
					/>
				</label>
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
