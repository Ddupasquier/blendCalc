<script lang="ts">
	import { enhance } from "$app/forms";
	import { onMount } from "svelte";
	import type { SubmitFunction } from "@sveltejs/kit";
	import type { ActionData, PageData } from "./$types";

	let {
		data,
		form,
	}: {
		data: PageData;
		form: ActionData;
	} = $props();

	let providerError = $state("");
	let email = $state("");
	let isSubmitting = $state(false);

	const preventDuplicateSubmit: SubmitFunction = () => {
		if (isSubmitting) return () => {};
		isSubmitting = true;

		return async ({ update }) => {
			await update();
			isSubmitting = false;
		};
	};

	const authErrorMessages: Record<string, string> = {
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
	});

	onMount(() => {
		const params = new URLSearchParams(window.location.hash.slice(1));
		providerError = params.get("error_description") ?? "";
	});
</script>

<section class="auth-page">
	<div class="auth-card">
		<div class="auth-card__header">
			<h2>Sign in</h2>
			<p>
				Use email or Google to sync your fridge, saved drinks, and custom
				ingredients.
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

		<form class="email-form" method="POST" use:enhance={preventDuplicateSubmit}>
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
					autocomplete="current-password"
					placeholder="At least 8 characters"
					required
					minlength="8"
				/>
			</label>
			<div class="email-form__actions">
				<button
					class="email-button"
					type="submit"
					formaction="?/emailSignIn"
					disabled={isSubmitting}
				>
					{isSubmitting ? "Working…" : "Sign in"}
				</button>
				<button
					class="email-button email-button--secondary"
					type="submit"
					formaction="?/emailSignUp"
					disabled={isSubmitting}
				>
					Create account
				</button>
			</div>
			<button
				class="password-reset-button"
				type="submit"
				formaction="?/requestPasswordReset"
				formnovalidate
				disabled={isSubmitting}
			>
				Forgot your password?
			</button>
		</form>

		<div class="auth-divider" aria-hidden="true">
			<span></span>
			<em>or</em>
			<span></span>
		</div>

		<form method="POST" action="?/google" use:enhance={preventDuplicateSubmit}>
			<input type="hidden" name="next" value={form?.next ?? data.next} />
			<button class="google-button" type="submit" disabled={isSubmitting}>
				<span aria-hidden="true">G</span>
				{isSubmitting ? "Opening Google…" : "Continue with Google"}
			</button>
		</form>

		<p class="auth-note">
			Your data saves to your account. This browser only keeps a local cache for
			the signed-in user.
		</p>
	</div>
</section>

<style lang="scss">
	@use "../../styles/variables" as *;

	.auth-page {
		display: grid;
		place-items: center;
		min-height: 55vh;
	}

	.auth-card {
		display: grid;
		gap: $app-gap-md;
		width: min(100%, 26rem);
		padding: $app-gap-md;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;
		box-shadow: $app-box-shadow;
	}

	.auth-card__header {
		display: grid;
		gap: 0.25rem;

		h2 {
			color: $app-primary;
			font-size: $app-font-size-xl;
			font-weight: 800;
		}

		p {
			color: $app-muted;
			font-size: $app-font-size-md;
			line-height: 1.4;
		}
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
			height: $app-control-height;
			padding: 0 0.75rem;
			color: $app-primary;
			background: $app-bg;
			border: $app-border;
			border-radius: $app-radius;
			font-size: $app-font-size-md;
			box-sizing: border-box;
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
		font-weight: 800;
		text-decoration: underline;
		text-underline-offset: 0.2rem;
	}

	.email-button,
	.google-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: $app-gap-sm;
		width: 100%;
		padding: 0.6rem 0.85rem;
		color: $app-btn-text;
		background: $app-btn-bg;
		border-radius: $app-radius-pill;
		font-weight: 900;

		&:hover {
			background: $app-btn-bg-hover;
		}

		&:disabled {
			cursor: wait;
			opacity: 0.65;
		}
	}

	.google-button {
		span {
			display: grid;
			place-items: center;
			width: 1.35rem;
			height: 1.35rem;
			color: $app-primary;
			background: $app-btn-text;
			border-radius: $app-radius-pill;
			font-weight: 900;
		}
	}

	.email-button--secondary {
		color: $app-primary;
		background: $app-accent;

		&:hover {
			background: $app-success-bg;
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
		color: $app-muted;
		font-size: $app-font-size-sm;
		line-height: 1.35;
	}

	@media (max-width: $app-breakpoint-xs) {
		.email-form__actions {
			grid-template-columns: 1fr;
		}
	}
</style>
