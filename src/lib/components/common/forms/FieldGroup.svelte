<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		id = "",
		label,
		helper = "",
		error = "",
		required = false,
		children,
	}: {
		id?: string;
		label: string;
		helper?: string;
		error?: string;
		required?: boolean;
		children?: Snippet;
	} = $props();

	const describedBy = $derived(
		[
			helper ? `${id}-helper` : "",
			error ? `${id}-error` : "",
		]
			.filter(Boolean)
			.join(" ") || undefined,
	);
</script>

<label class="field-group" for={id || undefined}>
	<span class="field-group__label">
		{label}
		{#if required}
			<span aria-hidden="true">*</span>
		{/if}
	</span>

	{#if children}
		<div class="field-group__control" data-describedby={describedBy}>
			{@render children()}
		</div>
	{/if}

	{#if helper}
		<span id={`${id}-helper`} class="field-group__helper">{helper}</span>
	{/if}
	{#if error}
		<span id={`${id}-error`} class="field-group__error" role="alert">{error}</span>
	{/if}
</label>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.field-group {
		display: grid;
		gap: $app-gap-xs;
		min-width: 0;
		color: $app-primary;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-bold;
	}

	.field-group__label {
		display: inline-flex;
		align-items: center;
		gap: 0.18rem;
		min-width: 0;
	}

	.field-group__control {
		min-width: 0;
	}

	.field-group__helper,
	.field-group__error {
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-medium;
		line-height: 1.3;
	}

	.field-group__helper {
		color: $app-muted;
	}

	.field-group__error {
		color: $app-warning-strong;
	}

	:global(.field-group__control > input),
	:global(.field-group__control > select),
	:global(.field-group__control > textarea) {
		width: 100%;
		min-width: 0;
		color: $app-primary;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius-sm;
	}
</style>
