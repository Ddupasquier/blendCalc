<script lang="ts">
	import BackButton from "$lib/components/common/buttons/BackButton.svelte";
	import SheetBase from "$lib/components/common/sheets/SheetBase.svelte";
	import type { BottomSheetProps } from "$lib/components/common/sheets/types";

	let {
		open,
		title,
		titleId = "bottom-sheet-title",
		label = title,
		backLabel = "Back",
		showBack = true,
		aboveNav = true,
		fill = false,
		comfortable = false,
		children,
		onClose,
	}: BottomSheetProps = $props();

</script>

<SheetBase
	{open}
	placement="bottom"
	label={title ? undefined : label}
	labelledby={title ? titleId : undefined}
	{aboveNav}
	{fill}
	{comfortable}
	{onClose}
>
	<div
		class="bottom-sheet"
	>
		<div class="bottom-sheet__chrome">
			<button class="bottom-sheet__handle" type="button" aria-label="Close sheet" onclick={onClose}>
				<span aria-hidden="true"></span>
			</button>
			<div
				class="bottom-sheet__header"
				class:bottom-sheet__header--without-back={!showBack}
			>
				{#if showBack}
					<BackButton class="bottom-sheet__back" label={backLabel} onclick={onClose} />
				{/if}
				{#if title}
					<h2 id={titleId}>{title}</h2>
				{/if}
			</div>
		</div>
		<div class="bottom-sheet__content">
			{@render children()}
		</div>
	</div>
</SheetBase>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.bottom-sheet {
		display: flex;
		flex-direction: column;
		gap: $app-gap-sm;
		flex: 1 1 auto;
		min-height: 0;
		overflow: hidden;

		h2 {
			margin: 0;
			overflow: hidden;
			color: $app-shell-text-primary;
			font-family: $app-font-family-display;
			font-size: $app-font-size-lg;
			font-weight: $app-font-weight-bold;
			line-height: 1.1;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	.bottom-sheet__chrome {
		position: sticky;
		top: 0;
		z-index: 1;
		display: grid;
		gap: $app-gap-sm;
		flex: 0 0 auto;
		background: $app-shell-surface-panel;
	}

	.bottom-sheet__handle {
		justify-self: center;
		display: grid;
		place-items: center;
		width: 4rem;
		height: $app-bottom-sheet-handle-height;
		padding: 0;
		background: transparent;
		border: 0;
		border-radius: $app-radius-pill;
		cursor: pointer;

		span {
			display: block;
			width: $app-bottom-sheet-handle-width;
			height: $app-bottom-sheet-handle-thickness;
			margin: 0 auto;
			background: color-mix(in srgb, $app-shell-text-muted 24%, transparent);
			border-radius: $app-radius-pill;
		}

		&:focus-visible {
			outline: $app-focus-outline;
			outline-offset: 0;
		}
	}

	.bottom-sheet__header {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: $app-gap-sm;
		min-height: $app-bottom-sheet-back-size;
	}

	.bottom-sheet__header--without-back {
		grid-template-columns: minmax(0, 1fr);
	}

	:global(.bottom-sheet__back) {
		width: $app-bottom-sheet-back-size;
		height: $app-bottom-sheet-back-size;
	}

	.bottom-sheet__content {
		display: grid;
		align-content: start;
		align-items: start;
		flex: 1 1 auto;
		gap: $app-gap-md;
		grid-auto-rows: max-content;
		min-width: 0;
		min-height: 0;
		padding-bottom: $app-gap-md;
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
	}
</style>
