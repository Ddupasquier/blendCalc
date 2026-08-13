<script lang="ts">
	import type { AuthenticatorVerificationCodeFieldProps } from "./types";

	let {
		disabled = false,
		id = "authenticator-verification-code",
		invalid = false,
		name = "code",
	}: AuthenticatorVerificationCodeFieldProps = $props();

	const helperId = $derived(`${id}-help`);
</script>

<div class="authenticator-code-field">
	<label class="authenticator-code-field__label" for={id}>Six-digit code</label>
	<input
		{id}
		{name}
		type="text"
		inputmode="numeric"
		autocomplete="one-time-code"
		autocapitalize="none"
		spellcheck={false}
		placeholder="Current code"
		required
		aria-describedby={helperId}
		aria-invalid={invalid}
		{disabled}
	/>
	<small id={helperId}>
		Use the current code shown in your app—not the example. Spaces are okay.
	</small>
</div>

<style lang="scss">
	@use "./AuthenticatorVerificationCodeField.scss";
</style>
