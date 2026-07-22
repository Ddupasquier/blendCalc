<script lang="ts">
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import type { ConfirmationDialogProps } from "./types";

	let {
		open,
		title,
		description,
		confirmLabel = "Confirm",
		cancelLabel = "Cancel",
		busy = false,
		danger = false,
		onConfirm,
		onCancel,
	}: ConfirmationDialogProps = $props();
</script>

{#if open}
	<div
		class="confirmation-backdrop"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget && !busy) onCancel();
		}}
	>
		<div
			class="confirmation-dialog"
			role="alertdialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="confirmation-dialog-title"
			aria-describedby="confirmation-dialog-description"
		>
			<div>
				<h2 id="confirmation-dialog-title">{title}</h2>
				<p id="confirmation-dialog-description">{description}</p>
			</div>
			<div class="confirmation-dialog__actions">
				<ActionButton variant="ghost" disabled={busy} onclick={onCancel}>
					{cancelLabel}
				</ActionButton>
				<ActionButton
					variant={danger ? "danger" : "primary"}
					busy={busy}
					onclick={onConfirm}
				>
					{confirmLabel}
				</ActionButton>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	@use "./ConfirmationDialog.scss";
</style>
