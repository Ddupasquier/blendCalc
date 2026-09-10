<script lang="ts">
	import { enhance } from "$app/forms";
	import GoogleG from "$lib/assets/icons/GoogleG/GoogleG.svelte";
	import GuestAccessPageShell from "$lib/components/auth/GuestAccessPageShell/GuestAccessPageShell.svelte";
	import PasswordRequirements from "$lib/components/auth/PasswordRequirements/PasswordRequirements.svelte";
	import TurnstileChallenge from "$lib/components/auth/TurnstileChallenge/TurnstileChallenge.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import ToggleSwitch from "$lib/components/common/forms/ToggleSwitch/ToggleSwitch.svelte";
	import { APP_NAME } from "$lib/config/brand";
	import { formatDocumentTitle } from "$lib/config/pageMetadata";
	import {
		isPasswordPolicyCompliant,
		PASSWORD_MIN_LENGTH,
	} from "$lib/utils/auth/passwordPolicy";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import type { AuthMode, AuthPageProps } from "./types";

	let { data, form }: AuthPageProps = $props();

	let email = $state("");
	let password = $state("");
	let passwordConfirmation = $state("");
	let marketingEmailOptIn = $state(false);
	let authMode = $state<AuthMode>("signIn");
	let isSubmitting = $state(false);
	let captchaResetVersion = $state(0);
	let realSignInFlowOverride = $state<boolean | null>(null);
	let qaAccountOverride = $state<string | null>(null);
	const useRealSignInFlow = $derived(
		realSignInFlowOverride ?? !data.localQaSignIn,
	);
	const qaAccount = $derived(
		qaAccountOverride ??
			data.localQaSignIn?.accounts.find(({ key }) => key === "user")?.key ??
			data.localQaSignIn?.accounts[0]?.key ??
			"",
	);

	const selectedQaAccount = $derived(
		data.localQaSignIn?.accounts.find(({ key }) => key === qaAccount) ?? null,
	);
	const qaAccountOptions = $derived(
		data.localQaSignIn?.accounts.map((account) => ({
			value: account.key,
			label: `${account.displayName} · ${account.email}`,
		})) ?? [],
	);
	const quickQaSignInActive = $derived(
		Boolean(data.localQaSignIn) && !useRealSignInFlow,
	);
	const passwordConfirmationInvalid = $derived(
		passwordConfirmation.length > 0 && password !== passwordConfirmation,
	);
	const signUpPasswordReady = $derived(
		isPasswordPolicyCompliant(password, email) &&
			passwordConfirmation.length > 0 &&
			password === passwordConfirmation,
	);

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
		if (
			form &&
			"marketingEmailOptIn" in form &&
			typeof form.marketingEmailOptIn === "boolean"
		) {
			marketingEmailOptIn = form.marketingEmailOptIn;
		}
		if (form?.mode === "signUp" || form?.mode === "signIn") {
			authMode = form.mode;
		}
		if (form?.signInExperience === "quickQa" && data.localQaSignIn) {
			realSignInFlowOverride = false;
		}
		if (
			form &&
			"qaAccount" in form &&
			typeof form.qaAccount === "string" &&
			data.localQaSignIn?.accounts.some(({ key }) => key === form.qaAccount)
		) {
			qaAccountOverride = form.qaAccount;
		}
	});

	const switchAuthMode = (mode: AuthMode) => {
		authMode = mode;
		password = "";
		passwordConfirmation = "";
		marketingEmailOptIn = false;
		captchaResetVersion += 1;
	};
</script>

<svelte:head>
	<title
		>{formatDocumentTitle(
			quickQaSignInActive
				? "Local QA Sign In"
				: authMode === "signUp"
					? "Create Account"
					: "Sign In",
		)}</title
	>
</svelte:head>

<GuestAccessPageShell>
	<div class="auth-content">
		<header class="auth-content__header">
			<a class="auth-brand" href="/">{APP_NAME}</a>
			<div class="auth-content__intro">
				<p class="auth-eyebrow">Your food awareness workspace</p>
				<h1>
					{quickQaSignInActive
						? "Choose a QA account."
						: authMode === "signUp"
							? "Create your account."
							: "Welcome back."}
				</h1>
				<p>
					{quickQaSignInActive
						? "Start a real session in the isolated test database without typing its disposable password."
						: authMode === "signUp"
							? "Save your ingredients, recipes, food preferences, and nutrition goals securely to your account."
							: "Sign in to access your ingredients, recipes, food preferences, and nutrition goals."}
				</p>
			</div>
		</header>

		{#if data.localQaSignIn}
			<section class="local-qa-mode" aria-labelledby="local-qa-mode-title">
				<span class="local-qa-mode__badge">Local test only</span>
				<label class="local-qa-mode__toggle" for="use-real-sign-in-flow">
					<span>
						<strong id="local-qa-mode-title">Test the real sign-in flow</strong>
						<small>
							{useRealSignInFlow
								? "On — use the normal Google or email sign-in experience."
								: "Off — choose a seeded QA account for quick login."}
						</small>
					</span>
					<ToggleSwitch
						id="use-real-sign-in-flow"
						checked={useRealSignInFlow}
						disabled={isSubmitting}
						ariaLabel="Test the real sign-in flow"
						onChange={(checked) => {
							realSignInFlowOverride = checked;
							authMode = "signIn";
						}}
					/>
				</label>
			</section>
		{/if}

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

		{#if quickQaSignInActive}
			<form
				class="quick-qa-form"
				method="POST"
				action="?/quickQaSignIn"
				use:enhance={preventDuplicateSubmit}
				aria-busy={isSubmitting}
			>
				<input type="hidden" name="next" value={form?.next ?? data.next} />
				<SelectField
					id="local-qa-account"
					name="qaAccount"
					label="QA account"
					value={qaAccount}
					options={qaAccountOptions}
					helper={selectedQaAccount
						? `${selectedQaAccount.role} — ${selectedQaAccount.purpose}`
						: "Choose the test state you need."}
					required
					disabled={isSubmitting}
					onValueChange={(value) => (qaAccountOverride = value)}
				/>
				<RoundedActionButton type="submit" fullWidth busy={isSubmitting}>
					{selectedQaAccount
						? `Continue as ${selectedQaAccount.displayName}`
						: "Continue with QA account"}
				</RoundedActionButton>
			</form>
		{:else}
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
					<span
						class="google-button__icon"
						data-google-brand-icon
						aria-hidden="true"
					>
						<GoogleG />
					</span>
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
				<div class="email-form__credentials">
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
					<div class="email-form__password">
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
							minlength={authMode === "signUp"
								? PASSWORD_MIN_LENGTH
								: undefined}
							value={password}
							oninput={(event) => (password = event.currentTarget.value)}
						/>
						{#if authMode === "signIn"}
							<div class="password-reset-action">
								<RoundedActionButton
									type="submit"
									variant="link"
									formAction="?/requestPasswordReset"
									formNoValidate
									disabled={isSubmitting}
								>
									Forgot your password?
								</RoundedActionButton>
							</div>
						{/if}
					</div>
					{#if authMode === "signUp"}
						<TextField
							id="authentication-password-confirmation"
							name="passwordConfirmation"
							label="Confirm password"
							type="password"
							autocomplete="new-password"
							placeholder="Enter it again"
							aria-describedby="password-match-requirement"
							aria-invalid={passwordConfirmationInvalid}
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
						<input
							type="hidden"
							name="marketingEmailOptIn"
							value={marketingEmailOptIn ? "true" : "false"}
						/>
						<label
							class="email-form__marketing-choice"
							for="authentication-marketing-email-opt-in"
						>
							<span>
								<strong>Optional blendCalc email</strong>
								<small>
									Send me product and launch updates, testing invitations, and
									future tips. I can change each category anytime.
								</small>
							</span>
							<ToggleSwitch
								id="authentication-marketing-email-opt-in"
								checked={marketingEmailOptIn}
								disabled={isSubmitting}
								ariaLabel="Receive optional blendCalc promotional messages"
								onChange={(checked) => (marketingEmailOptIn = checked)}
							/>
						</label>
					{/if}
				</div>
				{#if data.turnstileSiteKey}
					<TurnstileChallenge
						siteKey={data.turnstileSiteKey}
						resetVersion={captchaResetVersion}
					/>
				{/if}
				<div class="email-form__actions">
					<RoundedActionButton
						type="submit"
						fullWidth
						busy={isSubmitting}
						disabled={authMode === "signUp" && !signUpPasswordReady}
					>
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
			</form>
		{/if}

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
