<script lang="ts">
	import type { Snippet } from "svelte";
	import ActionButton from "$lib/components/common/ActionButton.svelte";
	import BottomSheet from "$lib/components/common/BottomSheet.svelte";

	let {
		open = false,
		title,
		description = "",
		label,
		placeholder = "",
		confirmLabel = "Save",
		secondaryConfirmLabel = "",
		cancelLabel = "Cancel",
		initialValue = "",
		error = "",
		busy = false,
		children,
		onConfirm,
		onSecondaryConfirm,
		onValueChange,
		onCancel,
	}: {
		open?: boolean;
		title: string;
		description?: string;
		label: string;
		placeholder?: string;
		confirmLabel?: string;
		secondaryConfirmLabel?: string;
		cancelLabel?: string;
		initialValue?: string;
		error?: string;
		busy?: boolean;
		children?: Snippet;
		onConfirm: (value: string) => void | Promise<void>;
		onSecondaryConfirm?: (value: string) => void | Promise<void>;
		onValueChange?: (value: string) => void;
		onCancel: () => void;
	} = $props();

	let value = $state("");
	let wasOpen = false;

	$effect(() => {
		if (open && !wasOpen) {
			value = initialValue;
		}
		wasOpen = open;
	});

	const confirm = () => {
		if (busy) return;
		onConfirm(value);
	};

	const secondaryConfirm = () => {
		if (busy) return;
		onSecondaryConfirm?.(value);
	};
</script>

<BottomSheet
	{open}
	{title}
	titleId="text-input-dialog-title"
	label={title}
	titleStyle="prominent"
	onClose={onCancel}
>
	<div class="text-input-sheet">
		{#if description}
			<p class="text-input-sheet__description">{description}</p>
		{/if}

		{#if children}
			<div class="text-input-sheet__content">
				{@render children()}
			</div>
		{/if}

		<label class="text-input-sheet__field">
			<span>{label}</span>
			<input
				id="text-input-dialog-value"
				name="text-input-dialog-value"
				type="text"
				bind:value
				{placeholder}
				disabled={busy}
				aria-invalid={error ? "true" : undefined}
				aria-describedby={error ? "text-input-dialog-error" : undefined}
				oninput={() => onValueChange?.(value)}
				onkeydown={(event) => {
					if (event.key === "Enter") confirm();
					if (event.key === "Escape") onCancel();
				}}
			/>
			{#if error}
				<span id="text-input-dialog-error" class="text-input-sheet__error" role="alert">
					{error}
				</span>
			{/if}
		</label>

		<div
			class="text-input-sheet__actions"
			class:text-input-sheet__actions--triple={secondaryConfirmLabel && onSecondaryConfirm}
		>
			<ActionButton variant="ghost" fullWidth disabled={busy} onclick={onCancel}>
				{cancelLabel}
			</ActionButton>
			{#if secondaryConfirmLabel && onSecondaryConfirm}
				<ActionButton
					variant="secondary"
					fullWidth
					disabled={busy}
					onclick={secondaryConfirm}
				>
					{secondaryConfirmLabel}
				</ActionButton>
			{/if}
			<ActionButton variant="success" fullWidth busy={busy} onclick={confirm}>
				{confirmLabel}
			</ActionButton>
		</div>
	</div>
</BottomSheet>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.text-input-sheet {
		display: grid;
		gap: $app-gap-md;
	}

	.text-input-sheet__description {
		margin: 0;
		color: $color-figma-muted;
		font-size: $app-font-size-md;
		line-height: 1.35;
	}

	.text-input-sheet__content {
		display: grid;
		gap: $app-gap-sm;
	}

	.text-input-sheet__field {
		display: grid;
		gap: $app-gap-xs;
		color: $color-figma-ink;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-bold;
	}

	input {
		width: 100%;
		min-height: $app-rebuild-control-height;
		padding: 0 $app-rebuild-control-padding-x;
		color: $color-figma-ink;
		background: $color-figma-soft-surface;
		border: 1px solid transparent;
		border-radius: $app-rebuild-radius-pill;
		font-size: $app-font-size-lg;
		box-sizing: border-box;

		&:focus {
			outline: none;
			border-color: $color-figma-green;
		}
	}

	.text-input-sheet__error {
		color: $color-figma-red;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
	}

	.text-input-sheet__actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: $app-horizontal-control-gap;
	}

	.text-input-sheet__actions--triple {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	@media (max-width: $app-breakpoint-xs) {
		.text-input-sheet__actions,
		.text-input-sheet__actions--triple {
			grid-template-columns: 1fr;
		}
	}
</style>
