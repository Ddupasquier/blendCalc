<script lang="ts">
	import { enhance } from "$app/forms";
	import AccountSecurityPageShell from "$lib/components/auth/AccountSecurityPageShell/AccountSecurityPageShell.svelte";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import RoundedActionLink from "$lib/components/common/buttons/RoundedActionLink/RoundedActionLink.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import { formatDocumentTitle } from "$lib/config/pageMetadata";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import type { MfaRecoveryPageProps } from "./types";

	let { data }: MfaRecoveryPageProps = $props();
	let isSigningOut = $state(false);
	const preventDuplicateSignOut = createPendingSubmit(
		(pending) => (isSigningOut = pending),
	);
</script>

<svelte:head>
	<title>{formatDocumentTitle("Authenticator Help")}</title>
</svelte:head>

<AccountSecurityPageShell
	eyebrow="Account recovery"
	title="Authenticator access is required."
	description="A password reset cannot remove this protection. That prevents someone with only your email password from taking over protected tools."
>
	<div class="mfa-recovery">
		<StatusMessage
			tone="warning"
			title="Use a verified recovery process"
			message="If your authenticator is unavailable, stop here. An administrator must verify your identity before removing the factor from your account."
		/>
		<RoundedActionLink
			href={`/auth/mfa/challenge?next=${encodeURIComponent(data.next)}`}
			variant="neutral"
			fullWidth
		>
			Try another code
		</RoundedActionLink>
		<form
			method="POST"
			action="/auth/logout"
			use:enhance={preventDuplicateSignOut}
			aria-busy={isSigningOut}
		>
			<ActionButton
				type="submit"
				variant="secondary"
				fullWidth
				busy={isSigningOut}
			>
				Sign out safely
			</ActionButton>
		</form>
	</div>
</AccountSecurityPageShell>

<style lang="scss">
	@use "./page.scss";
</style>
