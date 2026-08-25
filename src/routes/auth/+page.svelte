<script lang="ts">
	import { enhance } from "$app/forms";
	import GuestAccessPageShell from "$lib/components/auth/GuestAccessPageShell/GuestAccessPageShell.svelte";
	import PasswordRequirements from "$lib/components/auth/PasswordRequirements/PasswordRequirements.svelte";
	import TurnstileChallenge from "$lib/components/auth/TurnstileChallenge/TurnstileChallenge.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import { APP_NAME } from "$lib/config/brand";
	import { formatDocumentTitle } from "$lib/config/pageMetadata";
	import { PASSWORD_MIN_LENGTH } from "$lib/utils/auth/passwordPolicy";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import type { AuthMode, AuthPageProps } from "./types";

	let { data, form }: AuthPageProps = $props();

	let email = $state("");
	let password = $state("");
	let passwordConfirmation = $state("");
	let authMode = $state<AuthMode>("signIn");
	let isSubmitting = $state(false);
	let captchaResetVersion = $state(0);

	const preventDuplicateSubmit = createPendingSubmit(
		(pending) => (isSubmitting = pending),
		(result) => {
			if (result.type !== "redirect") captchaResetVersion += 1;
		},
	);

	const authErrorMessages: Record<string, string> = {
		account_blocked:
			"This account has been blocked. Contact support if you believe this is a mistake.",
		callback_exchange: "The returned sign-in code could not be verified.",
		missing_code: "The sign-in provider did not return a login code.",
		provider: "Google rejected or cancelled the sign-in request.",
		recovery_session: "That password reset link is invalid or has expired.",
		wrong_origin:
			"Sign in returned to a different app address. Start sign in again from this page.",
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
		captchaResetVersion += 1;
	};
</script>

<svelte:head>
	<title
		>{formatDocumentTitle(
			authMode === "signUp" ? "Create Account" : "Sign In",
		)}</title
	>
</svelte:head>

<GuestAccessPageShell>
	<div class="auth-content">
		<div class="auth-content__header">
			<a class="auth-brand" href="/">{APP_NAME}</a>
			<p class="auth-eyebrow">Your nutrition workspace</p>
			<h1>
				{authMode === "signUp" ? "Create your account." : "Welcome back."}
			</h1>
			<p>
				{authMode === "signUp"
					? "Save your ingredients, food combinations, and nutrition goals securely to your account."
					: "Sign in to access your ingredients, saved combinations, and nutrition goals."}
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
			aria-busy={isSubmitting}
		>
			<input type="hidden" name="next" value={form?.next ?? data.next} />
			<RoundedActionButton
				type="submit"
				variant="neutral"
				fullWidth
				busy={isSubmitting}
			>
				<span class="google-button__icon" aria-hidden="true">G</span>
				Continue with Google
			</RoundedActionButton>
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
			aria-busy={isSubmitting}
		>
			<input type="hidden" name="next" value={form?.next ?? data.next} />
			<TextField
				id="authentication-email"
				name="email"
				label="Email"
				type="email"
				autocomplete="email"
				placeholder="you@example.com"
				required
				disabled={isSubmitting}
				value={email}
				oninput={(event) => (email = event.currentTarget.value)}
			/>
			<TextField
				id="authentication-password"
				name="password"
				label="Password"
				type="password"
				autocomplete={authMode === "signUp"
					? "new-password"
					: "current-password"}
				placeholder={authMode === "signUp"
					? "Use a long passphrase"
					: "Your password"}
				aria-describedby={authMode === "signUp"
					? "password-requirements"
					: undefined}
				required
				disabled={isSubmitting}
				minlength={authMode === "signUp" ? PASSWORD_MIN_LENGTH : undefined}
				value={password}
				oninput={(event) => (password = event.currentTarget.value)}
			/>
			{#if authMode === "signUp"}
				<TextField
					id="authentication-password-confirmation"
					name="passwordConfirmation"
					label="Confirm password"
					type="password"
					autocomplete="new-password"
					placeholder="Enter it again"
					required
					disabled={isSubmitting}
					minlength={PASSWORD_MIN_LENGTH}
					value={passwordConfirmation}
					oninput={(event) =>
						(passwordConfirmation = event.currentTarget.value)}
				/>
				<PasswordRequirements
					{password}
					{email}
					confirmation={passwordConfirmation}
				/>
			{/if}
			{#if data.turnstileSiteKey}
				<TurnstileChallenge
					siteKey={data.turnstileSiteKey}
					resetVersion={captchaResetVersion}
				/>
			{/if}
			<div class="email-form__actions">
				<RoundedActionButton type="submit" fullWidth busy={isSubmitting}>
					{authMode === "signUp" ? "Create account" : "Sign in"}
				</RoundedActionButton>
				<RoundedActionButton
					type="button"
					variant="neutral"
					fullWidth
					onclick={() =>
						switchAuthMode(authMode === "signUp" ? "signIn" : "signUp")}
					disabled={isSubmitting}
				>
					{authMode === "signUp" ? "Back to sign in" : "Create account"}
				</RoundedActionButton>
			</div>
			{#if authMode === "signIn"}
				<div class="password-reset-action">
					<RoundedActionButton
						type="submit"
						variant="quiet"
						formAction="?/requestPasswordReset"
						formNoValidate
						disabled={isSubmitting}
					>
						Forgot your password?
					</RoundedActionButton>
				</div>
			{/if}
		</form>

		<p class="auth-note">
			<span aria-hidden="true">●</span>
			Your data is tied to your account. This device only keeps a private local cache
			while you are signed in.
		</p>
	</div>
</GuestAccessPageShell>

<style lang="scss">
	@use "./page.scss";
</style>
