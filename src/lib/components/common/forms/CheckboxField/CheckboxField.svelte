<script lang="ts">
	import type { CheckboxFieldProps } from "./types";

	let {
		id,
		name,
		value,
		checked = false,
		required = false,
		disabled = false,
		children,
	}: CheckboxFieldProps = $props();
</script>

<label class="checkbox-field" for={id}>
	<input {id} {name} {value} type="checkbox" {checked} {required} {disabled} />
	<span>{@render children()}</span>
</label>

<style lang="scss">
	@use "./CheckboxField.scss";
</style>
