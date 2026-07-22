<script lang="ts">
	import { enhance } from "$app/forms";
	import PasswordRequirements from "$lib/components/auth/PasswordRequirements/PasswordRequirements.svelte";
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import { PASSWORD_MIN_LENGTH } from "$lib/utils/auth/passwordPolicy";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import type { UpdatePasswordPageProps } from "./types";

	let {
		data,
		form,
	}: UpdatePasswordPageProps = $props();
	let password = $state("");
	let passwordConfirmation = $state("");
	let isSubmitting = $state(false);
	const preventDuplicateSubmit = createPendingSubmit(
		(pending) => (isSubmitting = pending),
	);
</script>

<section class="password-page">
	<form class="password-card" method="POST" use:enhance={preventDuplicateSubmit} aria-busy={isSubmitting}>
		<input type="hidden" name="next" value={form?.next ?? data.next} />
		<header>
			<p class="password-eyebrow">
				{data.reason === "policy" ? "Security update" : "Password recovery"}
			</p>
			<h1>Choose a new password.</h1>
			<p>
				{data.reason === "policy"
					? "Your existing password no longer meets the app’s security standard. Update it once to continue."
					: "Set a new password for your account."}
			</p>
		</header>

		{#if form?.message}
			<p class="password-error" role="alert">{form.message}</p>
		{/if}

		<label>
			<span>New password</span>
			<input
				type="password"
				name="password"
				autocomplete="new-password"
				aria-describedby="password-requirements"
				minlength={PASSWORD_MIN_LENGTH}
				placeholder="Use a long passphrase"
				required
				disabled={isSubmitting}
				bind:value={password}
			/>
		</label>
		<label>
			<span>Confirm password</span>
			<input
				type="password"
				name="passwordConfirmation"
				autocomplete="new-password"
				minlength={PASSWORD_MIN_LENGTH}
				placeholder="Enter it again"
				required
				disabled={isSubmitting}
				bind:value={passwordConfirmation}
			/>
		</label>
		<PasswordRequirements
			{password}
			email={data.email}
			confirmation={passwordConfirmation}
		/>
		<button type="submit" disabled={isSubmitting}>
			{#if isSubmitting}<LoadingSpinner size="small" decorative />{/if}
			Update password
		</button>
	</form>
</section>

<style lang="scss">
	@use "./page.scss";
</style>
