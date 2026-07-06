<script lang="ts">
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
	} = $props<{
		open: boolean;
		title: string;
		description: string;
		confirmLabel?: string;
		cancelLabel?: string;
		busy?: boolean;
		danger?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	}>();
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
				<button type="button" onclick={onCancel} disabled={busy}>{cancelLabel}</button>
				<button
					class:confirmation-dialog__danger={danger}
					type="button"
					onclick={onConfirm}
					disabled={busy}
				>
					{busy ? `${confirmLabel}…` : confirmLabel}
				</button>
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

		button {
			padding: 0.6rem 1rem;
			color: $app-primary;
			background: $app-accent;
			border-radius: $app-radius-pill;
			font-family: $app-button-font-family;
			font-weight: $app-button-font-weight;
			line-height: $app-button-line-height;
		}

		button:disabled {
			cursor: wait;
			opacity: 0.65;
		}
	}

	.confirmation-dialog__danger {
		color: $app-btn-text !important;
		background: $app-warning-strong !important;
	}
</style>
