<script lang="ts">
	import type { Snippet } from "svelte";

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

{#if open}
	<div class="dialog-backdrop" role="presentation">
		<div
			class="dialog"
			role="dialog"
			aria-modal="true"
			aria-labelledby="text-input-dialog-title"
		>
			<header>
				<h3 id="text-input-dialog-title">{title}</h3>
				{#if description}
					<p>{description}</p>
				{/if}
			</header>

			{#if children}
				<div class="dialog-content">
					{@render children()}
				</div>
			{/if}

			<label>
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
					<span id="text-input-dialog-error" class="dialog-error" role="alert">
						{error}
					</span>
				{/if}
			</label>

			<div class="dialog-actions">
				<button class="dialog-cancel" type="button" onclick={onCancel} disabled={busy}>
					{cancelLabel}
				</button>
				{#if secondaryConfirmLabel && onSecondaryConfirm}
					<button
						class="dialog-secondary-confirm"
						type="button"
						onclick={secondaryConfirm}
						disabled={busy}
					>
						{secondaryConfirmLabel}
					</button>
				{/if}
				<button class="dialog-confirm" type="button" onclick={confirm} disabled={busy}>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	@use "../../../styles/variables" as *;

	.dialog-backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		padding: $app-padding;
		background: $app-overlay-bg;
		backdrop-filter: blur(2px);
	}

	.dialog {
		width: min(26rem, 100%);
		padding: $app-gap-md;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;
	}

	header {
		margin-bottom: $app-gap-md;

		h3 {
			margin-bottom: 0.25rem;
			color: $app-primary;
			font-size: $app-font-size-xl;
			font-weight: 800;
		}

		p {
			color: $app-muted;
			font-size: $app-font-size-md;
			line-height: 1.4;
		}
	}

	.dialog-content {
		margin-bottom: $app-gap-md;
	}

	label {
		display: grid;
		gap: 0.35rem;
		color: $app-primary;
		font-size: $app-font-size-md;
		font-weight: 800;
	}

	input {
		width: 100%;
		height: 2.45rem;
		padding: 0 0.75rem;
		color: $app-primary;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius;
		font-size: $app-font-size-lg;
		box-sizing: border-box;
	}

	.dialog-error {
		color: $app-warning-strong;
		font-size: $app-font-size-sm;
		font-weight: 800;
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.55rem;
		margin-top: $app-gap-md;
	}

	button {
		border-radius: $app-radius-pill;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
		padding: 0.55rem 1rem;
	}

	.dialog-cancel {
		color: $app-primary;
		background: $app-accent;
	}

	.dialog-secondary-confirm {
		color: $app-primary;
		background: $app-success-bg;
	}

	.dialog-confirm {
		color: $app-btn-text;
		background: $app-btn-bg;

		&:hover {
			background: $app-btn-bg-hover;
		}
	}

	@media (max-width: $app-breakpoint-xs) {
		.dialog-actions {
			display: grid;
			grid-template-columns: 1fr;
		}
	}
</style>
