<script lang="ts">
	import type { ActionData } from "./$types";

	let { form }: { form: ActionData } = $props();
</script>

<section class="password-page">
	<form class="password-card" method="POST">
		<header>
			<h2>Choose a new password</h2>
			<p>Use at least 8 characters and do not reuse an important password.</p>
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
				minlength="8"
				required
			/>
		</label>
		<label>
			<span>Confirm password</span>
			<input
				type="password"
				name="passwordConfirmation"
				autocomplete="new-password"
				minlength="8"
				required
			/>
		</label>
		<button type="submit">Update password</button>
	</form>
</section>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.password-page {
		display: grid;
		place-items: center;
		min-height: 55vh;
	}

	.password-card {
		display: grid;
		gap: $app-gap-md;
		width: min(100%, 26rem);
		padding: $app-gap-md;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;
		box-shadow: $app-box-shadow;

		header,
		label {
			display: grid;
			gap: $app-gap-xs;
		}

		h2,
		label span {
			color: $app-primary;
			font-weight: 800;
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
			font-weight: 900;
		}
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
