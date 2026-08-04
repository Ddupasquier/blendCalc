<script lang="ts">
	import Check from "$lib/assets/icons/Check/Check.svelte";
	import Minus from "$lib/assets/icons/Minus/Minus.svelte";
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

{#snippet requirementStatus(valid: boolean)}
	<span class="password-requirements__status" class:valid aria-hidden="true">
		{#if valid}
			<Check size={14} />
		{:else}
			<Minus size={14} />
		{/if}
	</span>
{/snippet}

<div class="password-requirements" id="password-requirements">
	<p>Use a long, unique password or passphrase.</p>
	<ul>
		<li class:valid={hasInput && !issueCodes.has("too_short") && !issueCodes.has("too_long")}>
			{@render requirementStatus(hasInput && length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH)}
			{PASSWORD_MIN_LENGTH}–{PASSWORD_MAX_LENGTH} characters
		</li>
		<li class:valid={hasInput && !issueCodes.has("common")}>
			{@render requirementStatus(hasInput && !issueCodes.has("common"))}
			Not a commonly used password
		</li>
		<li class:valid={hasInput && !issueCodes.has("contains_email")}>
			{@render requirementStatus(hasInput && !issueCodes.has("contains_email"))}
			Does not contain your email name
		</li>
		{#if confirmation !== undefined}
			<li class:valid={confirmation.length > 0 && password === confirmation}>
				{@render requirementStatus(confirmation.length > 0 && password === confirmation)}
				Passwords match
			</li>
		{/if}
	</ul>
</div>

<style lang="scss">
	@use "./PasswordRequirements.scss";
</style>
