<script lang="ts">
	import { enhance } from "$app/forms";
	import { onMount } from "svelte";
	import FloatingFruitBackground from "$lib/components/app/FloatingFruitBackground.svelte";
	import PasswordRequirements from "$lib/components/auth/PasswordRequirements.svelte";
	import { PASSWORD_MIN_LENGTH } from "$lib/utils/auth/passwordPolicy";
	import type { SubmitFunction } from "@sveltejs/kit";
	import type { ActionData, PageData } from "./$types";

	type AuthMode = "signIn" | "signUp";

	let {
		data,
		form,
	}: {
		data: PageData;
		form: ActionData;
	} = $props();

	let providerError = $state("");
	let email = $state("");
	let password = $state("");
	let passwordConfirmation = $state("");
	let authMode = $state<AuthMode>("signIn");
	let isSubmitting = $state(false);
	let authCard = $state<HTMLDivElement>();

	const preventDuplicateSubmit: SubmitFunction = () => {
		if (isSubmitting) return () => {};
		isSubmitting = true;

		return async ({ update }) => {
			await update();
			isSubmitting = false;
		};
	};

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

	onMount(() => {
		const params = new URLSearchParams(window.location.hash.slice(1));
		providerError = params.get("error_description") ?? "";
	});
</script>

<section class="auth-page">
	<FloatingFruitBackground focusElement={authCard} />
	<div class="auth-card" bind:this={authCard}>
		<div class="auth-card__header">
			<a class="auth-brand" href="/">Smoothie Mixer</a>
			<p class="auth-eyebrow">Your smoothie space</p>
			<h1>{authMode === "signUp" ? "Create your account." : "Welcome back."}</h1>
			<p>
				{authMode === "signUp"
					? "Save your ingredients, drinks, and nutrition goals securely to your account."
					: "Sign in to pick up your fridge, saved drinks, and nutrition goals right where you left them."}
			</p>
		</div>

		{#if data.authError}
			<p class="auth-error" role="alert">
				Sign in did not complete.
				{#if providerError}
					<span>{providerError}</span>
				{:else}
					<span>{authErrorMessages[data.authError] ?? "Try again."}</span>
				{/if}
			</p>
		{/if}
		{#if form?.message}
			<p class="auth-error" role="alert">{form.message}</p>
		{/if}
		{#if form?.success}
			<p class="auth-success" role="status">{form.success}</p>
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
				{isSubmitting ? "Opening Google…" : "Continue with Google"}
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
					{isSubmitting
						? "Working…"
						: authMode === "signUp"
							? "Create account"
							: "Sign in"}
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
	@use "../../styles/variables" as *;

	.auth-page {
		position: relative;
		isolation: isolate;
		display: grid;
		place-items: center;
		min-height: 100svh;
		overflow: hidden;
		padding: clamp($app-gap-md, 5vw, 3rem) $app-gap-sm;
		background:
			radial-gradient(circle at 50% 44%, rgb(239 211 194 / 18%), transparent 38%),
			$app-bg;
	}

	.auth-card {
		position: relative;
		z-index: 1;
		display: grid;
		gap: 1.15rem;
		width: min(100%, 28rem);
		padding: clamp(1.25rem, 4vw, 1.75rem);
		background: $app-guest-surface;
		border: $app-border;
		border-radius: $app-guest-card-radius;
		box-shadow: $app-guest-card-shadow;
		backdrop-filter: blur(0.35rem);

		&::before {
			position: absolute;
			top: -1px;
			left: 12%;
			width: 28%;
			height: 3px;
			background: $app-highlight;
			border-radius: 0 0 $app-radius-pill $app-radius-pill;
			content: "";
		}
	}

	.auth-card__header {
		display: grid;
		gap: 0.5rem;

		h1 {
			color: $app-primary;
			font-family: $app-font-family-display;
			font-size: clamp(1.85rem, 7vw, 2.35rem);
			font-weight: $app-font-weight-bold;
			letter-spacing: -0.04em;
			line-height: 1.05;
		}

		p {
			color: $app-muted;
			font-size: $app-font-size-md;
			line-height: 1.4;
		}
	}

	.auth-brand {
		width: fit-content;
		color: $app-muted;
		font-size: $app-font-size-sm;
		font-weight: 800;
		letter-spacing: 0.02em;
		text-decoration: none;

		&::before {
			margin-right: 0.35rem;
			content: "←";
		}

		&:hover {
			color: $app-primary;
		}
	}

	.auth-eyebrow {
		width: fit-content;
		padding: 0.2rem 0.55rem;
		color: $app-primary !important;
		background: $app-accent;
		border-radius: $app-radius-pill;
		font-size: $app-font-size-xs !important;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.email-form {
		display: grid;
		gap: $app-gap-sm;

		label {
			display: grid;
			gap: 0.3rem;
			color: $app-primary;
			font-size: $app-font-size-md;
			font-weight: 800;
		}

		input {
			width: 100%;
			height: calc($app-control-height + 0.6rem);
			padding: 0 0.75rem;
			color: $app-primary;
			background: rgb(252 249 244 / 84%);
			border: $app-border;
			border-radius: $app-radius;
			font-size: $app-font-size-md;
			box-sizing: border-box;
			transition:
				border-color 0.15s ease,
				box-shadow 0.15s ease,
				background 0.15s ease;

			&:focus {
				background: $app-bg;
				border-color: $app-primary;
				box-shadow: 0 0 0 3px rgb(183 200 227 / 35%);
				outline: none;
			}
		}
	}

	.email-form__actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: $app-gap-sm;
		margin-top: 0.2rem;
	}

	.password-reset-button {
		justify-self: center;
		padding: 0.2rem;
		color: $app-primary;
		background: transparent;
		font-size: $app-font-size-sm;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
		text-decoration: none;
		text-underline-offset: 0.2rem;

		&:hover {
			text-decoration: underline;
		}
	}

	.email-button,
	.google-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: $app-gap-sm;
		width: 100%;
		min-height: 2.65rem;
		padding: 0.65rem 0.85rem;
		border-radius: $app-radius-pill;
		font-family: $app-button-font-family;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;

		&:hover {
			background: $app-btn-bg-hover;
		}

		&:disabled {
			cursor: wait;
			opacity: 0.65;
		}
	}

	.email-button {
		color: $app-highlight-text;
		background: $app-highlight;

		&:hover {
			background: $app-highlight-hover;
		}
	}

	.google-button {
		color: $app-primary;
		background: $app-bg;
		border: $app-border;
		box-shadow: $app-card-shadow;

		&:hover {
			background: white;
			border-color: $app-primary;
		}

		span {
			display: grid;
			place-items: center;
			width: 1.35rem;
			height: 1.35rem;
				color: white;
			background: $app-primary;
			border-radius: $app-radius-pill;
			font-weight: 900;
		}
	}

	.email-button--secondary {
		color: $app-primary;
		background: transparent;
		border: $app-border;

		&:hover {
			background: $app-accent;
		}
	}

	.auth-divider {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 0.6rem;
		align-items: center;
		color: $app-muted;
		font-size: $app-font-size-sm;
		font-weight: 800;

		span {
			height: 1px;
			background: $color-orchid-mist;
		}

		em {
			font-style: normal;
			text-transform: uppercase;
			letter-spacing: 0.08em;
		}
	}

	.auth-error {
		padding: 0.5rem 0.65rem;
		color: $app-warning-strong;
		background: $app-warning-bg;
		border: $app-warning-border;
		border-radius: $app-radius;
		font-size: $app-font-size-sm;
		font-weight: 800;
	}

	.auth-success {
		padding: 0.5rem 0.65rem;
		color: $app-primary;
		background: $app-success-bg;
		border: $app-border;
		border-radius: $app-radius;
		font-size: $app-font-size-sm;
		font-weight: 800;
	}

	.auth-note {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
		color: $app-muted;
		font-size: $app-font-size-xs;
		line-height: 1.35;

		span {
			color: $app-success-bg;
			font-size: 0.85rem;
			line-height: 1;
		}
	}

	@media (max-width: $app-breakpoint-xs) {
		.auth-card {
			gap: 1rem;
			padding: 1.15rem;
		}

		.email-form__actions {
			grid-template-columns: 1fr;
		}
	}
</style>
