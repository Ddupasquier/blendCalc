<script lang="ts">
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import BottomSheet from "$lib/components/common/sheets/BottomSheet/BottomSheet.svelte";
	import type { TextInputDialogProps } from "./types";

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
	}: TextInputDialogProps = $props();

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
				placeholder={placeholder || label}
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
	@use "./TextInputDialog.scss";
</style>
