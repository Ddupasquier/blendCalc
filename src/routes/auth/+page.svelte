<script lang="ts">
	import { enhance } from "$app/forms";
	import FloatingFruitBackground from "$lib/components/app/FloatingFruitBackground/FloatingFruitBackground.svelte";
	import PasswordRequirements from "$lib/components/auth/PasswordRequirements/PasswordRequirements.svelte";
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import { APP_NAME } from "$lib/config/brand";
	import { formatDocumentTitle } from "$lib/config/pageMetadata";
	import { PASSWORD_MIN_LENGTH } from "$lib/utils/auth/passwordPolicy";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import type { AuthMode, AuthPageProps } from "./types";

	let {
		data,
		form,
	}: AuthPageProps = $props();

	let email = $state("");
	let password = $state("");
	let passwordConfirmation = $state("");
	let authMode = $state<AuthMode>("signIn");
	let isSubmitting = $state(false);
	let authCard = $state<HTMLDivElement>();

	const preventDuplicateSubmit = createPendingSubmit(
		(pending) => (isSubmitting = pending),
	);

	const authErrorMessages: Record<string, string> = {
		account_blocked: "This account has been blocked. Contact support if you believe this is a mistake.",
		callback_exchange: "The returned sign-in code could not be verified.",
		missing_code: "The sign-in provider did not return a login code.",
		provider: "Google rejected or cancelled the sign-in request.",
		recovery_session: "That password reset link is invalid or has expired.",
		wrong_origin: "Sign in returned to a different app address. Start sign in again from this page.",
	};

	$effect(() => {
		if (form?.email !== undefined) {
			email = form.email;
		}
		if (form?.mode === "signUp" || form?.mode === "signIn") {
			authMode = form.mode;
		}
	});

	const switchAuthMode = (mode: AuthMode) => {
		authMode = mode;
		password = "";
		passwordConfirmation = "";
	};

</script>

<svelte:head>
	<title>{formatDocumentTitle(
		authMode === "signUp" ? "Create Account" : "Sign In",
	)}</title>
</svelte:head>

<section class="auth-page">
	<FloatingFruitBackground focusElement={authCard} />
	<div class="auth-card" bind:this={authCard}>
		<div class="auth-card__header">
			<a class="auth-brand" href="/">{APP_NAME}</a>
			<p class="auth-eyebrow">Your smoothie space</p>
			<h1>{authMode === "signUp" ? "Create your account." : "Welcome back."}</h1>
			<p>
				{authMode === "signUp"
					? "Save your ingredients, drinks, and nutrition goals securely to your account."
					: "Sign in to pick up your fridge, saved drinks, and nutrition goals right where you left them."}
			</p>
		</div>

		{#if data.authError}
			<StatusMessage
				tone="danger"
				title="Sign in didn’t complete"
				message={authErrorMessages[data.authError] ?? "Try again."}
			/>
		{/if}
		{#if form?.message}
			<StatusMessage tone="danger" message={form.message} />
		{/if}
		{#if form?.success}
			<StatusMessage tone="success" message={form.success} />
		{/if}

		<form
			class="google-form"
			method="POST"
			action="?/google"
			use:enhance={preventDuplicateSubmit}
		>
			<input type="hidden" name="next" value={form?.next ?? data.next} />
			<button class="google-button" type="submit" disabled={isSubmitting}>
				<span aria-hidden="true">G</span>
				{#if isSubmitting}<LoadingSpinner size="small" decorative />{/if}
				Continue with Google
			</button>
		</form>

		<div class="auth-divider" aria-hidden="true">
			<span></span>
			<em>or use email</em>
			<span></span>
		</div>

		<form
			class="email-form"
			method="POST"
			action={authMode === "signUp" ? "?/emailSignUp" : "?/emailSignIn"}
			use:enhance={preventDuplicateSubmit}
		>
			<input type="hidden" name="next" value={form?.next ?? data.next} />
			<label>
				<span>Email</span>
				<input
					type="email"
					name="email"
					autocomplete="email"
					placeholder="you@example.com"
					required
					bind:value={email}
				/>
			</label>
			<label>
				<span>Password</span>
				<input
					type="password"
					name="password"
					autocomplete={authMode === "signUp" ? "new-password" : "current-password"}
					placeholder={authMode === "signUp" ? "Use a long passphrase" : "Your password"}
					aria-describedby={authMode === "signUp" ? "password-requirements" : undefined}
					required
					minlength={authMode === "signUp" ? PASSWORD_MIN_LENGTH : undefined}
					bind:value={password}
				/>
			</label>
			{#if authMode === "signUp"}
				<label>
					<span>Confirm password</span>
					<input
						type="password"
						name="passwordConfirmation"
						autocomplete="new-password"
						placeholder="Enter it again"
						required
						minlength={PASSWORD_MIN_LENGTH}
						bind:value={passwordConfirmation}
					/>
				</label>
				<PasswordRequirements
					{password}
					{email}
					confirmation={passwordConfirmation}
				/>
			{/if}
			<div class="email-form__actions">
				<button
					class="email-button"
					type="submit"
					disabled={isSubmitting}
				>
					{#if isSubmitting}<LoadingSpinner size="small" decorative />{/if}
					{authMode === "signUp" ? "Create account" : "Sign in"}
				</button>
				<button
					class="email-button email-button--secondary"
					type="button"
					onclick={() => switchAuthMode(authMode === "signUp" ? "signIn" : "signUp")}
					disabled={isSubmitting}
				>
					{authMode === "signUp" ? "Back to sign in" : "Create account"}
				</button>
			</div>
			{#if authMode === "signIn"}
				<button
					class="password-reset-button"
					type="submit"
					formaction="?/requestPasswordReset"
					formnovalidate
					disabled={isSubmitting}
				>
					Forgot your password?
				</button>
			{/if}
		</form>

		<p class="auth-note">
			<span aria-hidden="true">●</span>
			Your data is tied to your account. This device only keeps a private local
			cache while you are signed in.
		</p>
	</div>
</section>

<style lang="scss">
	@use "./page.scss";
</style>
