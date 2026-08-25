<script lang="ts">
	import { enhance } from "$app/forms";
	import AccountSecurityPageShell from "$lib/components/auth/AccountSecurityPageShell/AccountSecurityPageShell.svelte";
	import PasswordRequirements from "$lib/components/auth/PasswordRequirements/PasswordRequirements.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import { PASSWORD_MIN_LENGTH } from "$lib/utils/auth/passwordPolicy";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import type { UpdatePasswordPageProps } from "./types";

	let { data, form }: UpdatePasswordPageProps = $props();
	let password = $state("");
	let passwordConfirmation = $state("");
	let isSubmitting = $state(false);
	const preventDuplicateSubmit = createPendingSubmit(
		(pending) => (isSubmitting = pending),
	);
</script>

<AccountSecurityPageShell
	eyebrow={data.reason === "policy" ? "Security update" : "Password recovery"}
	title="Choose a new password."
	description={data.reason === "policy"
		? "Your existing password no longer meets the app’s security standard. Update it once to continue."
		: "Set a new password for your account."}
>
	<form
		class="password-form"
		method="POST"
		use:enhance={preventDuplicateSubmit}
		aria-busy={isSubmitting}
	>
		<input type="hidden" name="next" value={form?.next ?? data.next} />
		{#if form?.message}
			<StatusMessage tone="danger" message={form.message} />
		{/if}

		<TextField
			id="new-password"
			name="password"
			label="New password"
			type="password"
			autocomplete="new-password"
			aria-describedby="password-requirements"
			minlength={PASSWORD_MIN_LENGTH}
			placeholder="Use a long passphrase"
			required
			disabled={isSubmitting}
			value={password}
			oninput={(event) => (password = event.currentTarget.value)}
		/>
		<TextField
			id="new-password-confirmation"
			name="passwordConfirmation"
			label="Confirm password"
			type="password"
			autocomplete="new-password"
			minlength={PASSWORD_MIN_LENGTH}
			placeholder="Enter it again"
			required
			disabled={isSubmitting}
			value={passwordConfirmation}
			oninput={(event) => (passwordConfirmation = event.currentTarget.value)}
		/>
		<PasswordRequirements
			{password}
			email={data.email}
			confirmation={passwordConfirmation}
		/>
		<RoundedActionButton type="submit" fullWidth busy={isSubmitting}>
			Update password
		</RoundedActionButton>
	</form>
</AccountSecurityPageShell>

<style lang="scss">
	@use "./page.scss";
</style>
