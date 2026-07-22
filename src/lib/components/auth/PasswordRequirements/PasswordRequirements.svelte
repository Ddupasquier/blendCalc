<script lang="ts">
	import {
		getPasswordLength,
		getPasswordPolicyIssues,
		PASSWORD_MAX_LENGTH,
		PASSWORD_MIN_LENGTH,
	} from "$lib/utils/auth/passwordPolicy";
	import type { PasswordRequirementsProps } from "./types";

	let {
		password,
		email = "",
		confirmation,
	}: PasswordRequirementsProps = $props();

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
	@use "./PasswordRequirements.scss";
</style>
