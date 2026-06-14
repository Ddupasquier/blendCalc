<script lang="ts">
	import {
		getPasswordLength,
		getPasswordPolicyIssues,
		PASSWORD_MAX_LENGTH,
		PASSWORD_MIN_LENGTH,
	} from "$lib/utils/auth/passwordPolicy";

	let {
		password,
		email = "",
		confirmation,
	}: {
		password: string;
		email?: string;
		confirmation?: string;
	} = $props();

	let length = $derived(getPasswordLength(password));
	let issueCodes = $derived(
		new Set(getPasswordPolicyIssues(password, email).map((issue) => issue.code)),
	);
	let hasInput = $derived(password.length > 0);
</script>

<div class="password-requirements" id="password-requirements">
	<p>Use a long, unique password or passphrase.</p>
	<ul>
		<li class:valid={hasInput && !issueCodes.has("too_short") && !issueCodes.has("too_long")}>
			<span aria-hidden="true">{hasInput && length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH ? "✓" : "○"}</span>
			{PASSWORD_MIN_LENGTH}–{PASSWORD_MAX_LENGTH} characters
		</li>
		<li class:valid={hasInput && !issueCodes.has("common")}>
			<span aria-hidden="true">{hasInput && !issueCodes.has("common") ? "✓" : "○"}</span>
			Not a commonly used password
		</li>
		<li class:valid={hasInput && !issueCodes.has("contains_email")}>
			<span aria-hidden="true">{hasInput && !issueCodes.has("contains_email") ? "✓" : "○"}</span>
			Does not contain your email name
		</li>
		{#if confirmation !== undefined}
			<li class:valid={confirmation.length > 0 && password === confirmation}>
				<span aria-hidden="true">{confirmation.length > 0 && password === confirmation ? "✓" : "○"}</span>
				Passwords match
			</li>
		{/if}
	</ul>
</div>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.password-requirements {
		display: grid;
		gap: $app-gap-xs;
		padding: 0.65rem 0.75rem;
		color: $app-muted;
		background: rgb(252 249 244 / 68%);
		border: $app-border;
		border-radius: $app-radius;
		font-size: $app-font-size-sm;

		p {
			font-weight: 800;
		}

		ul {
			display: grid;
			gap: 0.2rem;
			list-style: none;
		}

		li {
			display: flex;
			gap: 0.4rem;
			align-items: center;
		}

		li.valid {
			color: $app-primary;
		}

		span {
			width: 1rem;
			font-weight: 900;
			text-align: center;
		}

		li.valid span {
			color: $color-lavender-smoothie-dark;
		}
	}
</style>
