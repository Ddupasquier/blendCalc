<script lang="ts">
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import type { ConfirmationDialogProps } from "$lib/components/common/dialogs/types";

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
	@use "../../../../styles/variables" as *;

	.confirmation-backdrop {
		position: fixed;
		z-index: 1000;
		inset: 0;
		display: grid;
		place-items: center;
		padding: $app-gap-md;
		background: rgb(0 0 0 / 42%);
	}

	.confirmation-dialog {
		display: grid;
		gap: $app-gap-md;
		width: min(100%, 25rem);
		padding: $app-gap-md;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;

		h2 {
			margin-bottom: $app-gap-xs;
			color: $app-primary;
			font-family: $app-font-family-display;
			font-size: $app-font-size-xl;
		}

		p {
			color: $app-muted;
			font-size: $app-font-size-md;
			line-height: 1.45;
		}
	}

	.confirmation-dialog__actions {
		display: flex;
		justify-content: flex-end;
		gap: $app-gap-sm;
	}
</style>
