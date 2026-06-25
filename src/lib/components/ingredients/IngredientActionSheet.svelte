<script lang="ts">
	let {
		open,
		title,
		moveLabel,
		removeLabel,
		moving = false,
		removing = false,
		onClose,
		onRename,
		onMove,
		onRemove,
	}: {
		open: boolean;
		title: string;
		moveLabel: string;
		removeLabel: string;
		moving?: boolean;
		removing?: boolean;
		onClose: () => void;
		onRename: () => void;
		onMove: () => void;
		onRemove: () => void;
	} = $props();
</script>

{#if open}
	<div class="ingredient-action-sheet-backdrop" role="presentation" onclick={onClose}></div>
	<div
		class="ingredient-action-sheet"
		role="dialog"
		aria-modal="true"
		aria-labelledby="ingredient-action-sheet-title"
	>
		<span class="ingredient-action-sheet__handle" aria-hidden="true"></span>
		<h2 id="ingredient-action-sheet-title">{title}</h2>
		<div class="ingredient-action-sheet__actions">
			<button type="button" onclick={onRename}>
				<span aria-hidden="true">✎</span>
				Rename
			</button>
			<button
				type="button"
				class="ingredient-action-sheet__move"
				onclick={onMove}
				disabled={moving}
			>
				<span aria-hidden="true">⇄</span>
				{moveLabel}
			</button>
			<button
				type="button"
				class="ingredient-action-sheet__remove"
				onclick={onRemove}
				disabled={removing}
			>
				<span aria-hidden="true">⌫</span>
				{removeLabel}
			</button>
		</div>
	</div>
{/if}

<style lang="scss">
	@use "../../../styles/variables" as *;

	.ingredient-action-sheet-backdrop {
		position: fixed;
		inset: 0;
		z-index: 20;
		background: $app-rebuild-overlay-bg;
	}

	.ingredient-action-sheet {
		position: fixed;
		right: max(0rem, calc((100vw - $app-mobile-shell-width) / 2));
		bottom: $app-shell-nav-height;
		left: max(0rem, calc((100vw - $app-mobile-shell-width) / 2));
		z-index: 21;
		display: grid;
		gap: $app-gap-md;
		max-width: $app-mobile-shell-width;
		max-height: min(80vh, 30rem);
		padding: $app-gap-md $app-shell-padding-x;
		margin: 0 auto;
		overflow: auto;
		background: $color-figma-card;
		border-radius: $app-rebuild-radius-lg $app-rebuild-radius-lg 0 0;

		h2 {
			margin: 0;
			overflow: hidden;
			color: $color-figma-muted;
			font-size: $app-font-size-md;
			font-weight: $app-font-weight-bold;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	.ingredient-action-sheet__handle {
		justify-self: center;
		width: 2.25rem;
		height: calc($app-gap-xs - 0.05rem);
		background: color-mix(in srgb, $color-figma-muted 24%, transparent);
		border-radius: $app-radius-pill;
	}

	.ingredient-action-sheet__actions {
		display: grid;
		gap: $app-gap-sm;

		button {
			display: grid;
			grid-template-columns: auto minmax(0, 1fr);
			align-items: center;
			gap: $app-gap-sm;
			min-height: 3.8rem;
			padding: $app-gap-sm;
			color: $color-figma-sky;
			text-align: left;
			background: $color-figma-canvas;
			border: 0;
			border-radius: $app-rebuild-radius;
			font-family: $app-button-font-family;
			font-size: $app-font-size-md;
			font-weight: $app-button-font-weight;
			line-height: $app-button-line-height;

			span {
				display: inline-grid;
				place-items: center;
				width: $app-rebuild-food-icon-size;
				height: $app-rebuild-food-icon-size;
				background: color-mix(in srgb, currentColor 12%, $color-figma-card);
				border-radius: $app-radius;
			}
		}

		button:disabled {
			cursor: not-allowed;
			opacity: 0.55;
		}
	}

	.ingredient-action-sheet__move {
		color: $app-warning-strong !important;
	}

	.ingredient-action-sheet__remove {
		color: $color-figma-red !important;
	}
</style>
