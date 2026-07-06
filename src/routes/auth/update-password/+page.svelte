<script lang="ts">
	import { enhance } from "$app/forms";
	import PasswordRequirements from "$lib/components/auth/PasswordRequirements.svelte";
	import { PASSWORD_MIN_LENGTH } from "$lib/utils/auth/passwordPolicy";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import type { ActionData, PageData } from "./$types";

	let {
		data,
		form,
	}: {
		data: PageData;
		form: ActionData;
	} = $props();
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
			{isSubmitting ? "Updating password…" : "Update password"}
		</button>
	</form>
</section>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.password-page {
		display: grid;
		place-items: center;
		min-height: 100svh;
		padding: $app-gap-md $app-gap-sm;
	}

	.password-card {
		display: grid;
		gap: $app-gap-md;
		width: min(100%, 26rem);
		padding: $app-gap-md;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;

		header,
		label {
			display: grid;
			gap: $app-gap-xs;
		}

		h1,
		label span {
			color: $app-primary;
			font-weight: 800;
		}

		h1 {
			font-family: $app-font-family-display;
			font-size: $app-font-size-xl;
		}

		p {
			color: $app-muted;
			line-height: 1.4;
		}

		input {
			height: $app-control-height;
			padding: 0 0.75rem;
			background: $app-bg;
			border: $app-border;
			border-radius: $app-radius;
		}

		button {
			padding: 0.65rem 1rem;
			color: $app-btn-text;
			background: $app-btn-bg;
			border-radius: $app-radius-pill;
			font-weight: $app-button-font-weight;
			line-height: $app-button-line-height;
		}
	}

	.password-eyebrow {
		width: fit-content;
		padding: 0.18rem 0.5rem;
		color: $app-primary !important;
		background: $app-accent;
		border-radius: $app-radius-pill;
		font-size: $app-font-size-xs;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.password-error {
		padding: 0.5rem 0.65rem;
		color: $app-warning-strong !important;
		background: $app-warning-bg;
		border: $app-warning-border;
		border-radius: $app-radius;
		font-weight: 800;
	}
</style>
