<script lang="ts">
	import { onMount } from "svelte";
	import BackButton from "$lib/components/common/buttons/BackButton.svelte";
	import type { BarcodeScannerDialogProps } from "$lib/components/ingredients/barcode/types";
	import {
		isNativeBarcodePlatform,
		scanNativeBarcode,
		startWebBarcodeScanner,
	} from "$lib/utils/barcode/scanner";
	import type { BarcodeScannerStop } from "$lib/utils/barcode/types";
	import {
		manageDialogFocus,
		trapDialogFocus,
	} from "$lib/utils/accessibility/dialogFocus";

	let {
		open,
		onDetected,
		onClose,
	}: BarcodeScannerDialogProps = $props();

	let video = $state<HTMLVideoElement>();
	let dialogElement = $state<HTMLDivElement | null>(null);
	let stopScanner: BarcodeScannerStop | null = null;
	let error = $state("");
	let starting = $state(true);

	const close = () => {
		stopScanner?.();
		stopScanner = null;
		onClose();
	};

	const handleDialogKeydown = (event: KeyboardEvent) => {
		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			close();
			return;
		}
		if (dialogElement) trapDialogFocus(event, dialogElement);
	};

	onMount(() => {
		if (!open) return;
		let cancelled = false;
		const stopFocusManagement = dialogElement
			? manageDialogFocus(dialogElement)
			: () => undefined;

		const start = async () => {
			try {
				if (await isNativeBarcodePlatform()) {
					const result = await scanNativeBarcode();
					if (!cancelled && result) onDetected(result);
					else if (!cancelled) close();
					return;
				}
				if (!video) throw new Error("Camera preview is unavailable.");

				stopScanner = await startWebBarcodeScanner(video, {
					onDetected: (result) => {
						if (!cancelled) onDetected(result);
					},
					onError: (message) => {
						error = message;
					},
				});
			} catch {
				error =
					"Barcode scanning could not start. Enter the barcode manually instead.";
			} finally {
				starting = false;
			}
		};

		void start();
		return () => {
			cancelled = true;
			stopScanner?.();
			stopFocusManagement();
		};
	});
</script>

{#if open}
	<div
		class="barcode-scanner-backdrop"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) close();
		}}
	>
		<div
			bind:this={dialogElement}
			class="barcode-scanner"
			role="dialog"
			aria-modal="true"
			aria-labelledby="barcode-scanner-title"
			aria-describedby="barcode-scanner-help"
			tabindex="-1"
			onkeydown={handleDialogKeydown}
		>
			<header>
				<BackButton
					label="Close barcode scanner"
					variant="inverse"
					size="control"
					onclick={close}
				/>
				<div>
					<h2 id="barcode-scanner-title">Scan Barcode</h2>
					<p id="barcode-scanner-help">Align barcode within the frame.</p>
				</div>
			</header>

			<div class="barcode-scanner__camera">
				<video
					bind:this={video}
					muted
					playsinline
					aria-label="Live camera preview"
				></video>
				<div class="barcode-scanner__target" aria-hidden="true"></div>
				{#if starting}
					<p class="barcode-scanner__status" role="status">
						Starting camera…
					</p>
				{:else if !error}
					<p class="barcode-scanner__hint">Align barcode within the frame</p>
				{/if}
			</div>

			{#if error}
				<p class="barcode-scanner__error" role="alert">{error}</p>
			{/if}

			<!-- <button class="barcode-scanner__cancel" type="button" onclick={close}>Cancel</button> -->
		</div>
	</div>
{/if}

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.barcode-scanner-backdrop {
		position: fixed;
		z-index: 1000;
		inset: 0;
		display: grid;
		place-items: stretch center;
		padding: 0;
		overflow: hidden;
		background: $ingredient-scanner-overlay-bg;
		overscroll-behavior: contain;
	}

	.barcode-scanner {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		gap: $app-gap-md;
		width: min(100%, $ingredient-shell-max-width);
		min-height: 100vh;
		min-height: 100dvh;
		padding: calc($ingredient-shell-padding-y + env(safe-area-inset-top))
			$ingredient-shell-padding-x calc($ingredient-shell-padding-y + env(safe-area-inset-bottom));
		background: $ingredient-scanner-bg;
		border: 0;
		border-radius: 0;

		header {
			display: flex;
			align-items: center;
			justify-content: flex-start;
			gap: $app-gap-sm;
		}

		h2 {
			color: $ingredient-surface-card;
			font-family: $app-font-family-display;
			font-size: $app-font-size-xl;
			font-weight: $app-font-weight-heavy;
		}

		p {
			color: color-mix(in srgb, $ingredient-surface-card 52%, transparent);
			font-size: $app-font-size-md;
			line-height: 1.4;
		}
	}

	.barcode-scanner__camera {
		position: relative;
		min-height: 100%;
		overflow: hidden;
		background: $ingredient-scanner-bg;
		border-radius: 0;

		video {
			display: block;
			width: 100%;
			height: 100%;
			min-height: $ingredient-scanner-camera-min-height;
			object-fit: cover;
		}
	}

	.barcode-scanner__target {
		position: absolute;
		inset: 50% auto auto 50%;
		width: min($ingredient-scanner-target-width, $ingredient-scanner-target-max-width);
		height: $ingredient-scanner-target-height;
		border-radius: $ingredient-radius-card;
		background:
			linear-gradient($ingredient-accent-primary, $ingredient-accent-primary) top left /
				$ingredient-scanner-target-corner-long $ingredient-scanner-target-corner-thickness no-repeat,
			linear-gradient($ingredient-accent-primary, $ingredient-accent-primary) top left /
				$ingredient-scanner-target-corner-thickness $ingredient-scanner-target-corner-short no-repeat,
			linear-gradient($ingredient-accent-primary, $ingredient-accent-primary) top right /
				$ingredient-scanner-target-corner-long $ingredient-scanner-target-corner-thickness no-repeat,
			linear-gradient($ingredient-accent-primary, $ingredient-accent-primary) top right /
				$ingredient-scanner-target-corner-thickness $ingredient-scanner-target-corner-short no-repeat,
			linear-gradient($ingredient-accent-primary, $ingredient-accent-primary) bottom left /
				$ingredient-scanner-target-corner-long $ingredient-scanner-target-corner-thickness no-repeat,
			linear-gradient($ingredient-accent-primary, $ingredient-accent-primary) bottom left /
				$ingredient-scanner-target-corner-thickness $ingredient-scanner-target-corner-short no-repeat,
			linear-gradient($ingredient-accent-primary, $ingredient-accent-primary) bottom right /
				$ingredient-scanner-target-corner-long $ingredient-scanner-target-corner-thickness no-repeat,
			linear-gradient($ingredient-accent-primary, $ingredient-accent-primary) bottom right /
				$ingredient-scanner-target-corner-thickness $ingredient-scanner-target-corner-short no-repeat,
			color-mix(in srgb, $ingredient-accent-primary 6%, transparent);
		transform: translate(-50%, -50%);
	}

	.barcode-scanner__status,
	.barcode-scanner__hint {
		position: absolute;
		inset: calc(50% + $ingredient-scanner-status-offset) 50% auto auto;
		width: max-content;
		max-width: 80%;
		color: color-mix(in srgb, $ingredient-surface-card 58%, transparent) !important;
		text-align: center;
		transform: translateX(50%);
	}

	.barcode-scanner__status {
		padding: $ingredient-scanner-status-padding-y $ingredient-scanner-status-padding-x;
		color: $ingredient-accent-primary !important;
		background: rgba($ingredient-surface-card, 0.08);
		border-radius: $ingredient-radius-pill;
		font-weight: $app-font-weight-bold;
	}

	.barcode-scanner__error {
		padding: $app-gap-sm;
		color: $app-warning-strong !important;
		background: $app-warning-bg;
		border: $app-warning-border;
		border-radius: $app-radius;
	}

	@media (max-width: $app-breakpoint-sm) {
		.barcode-scanner {
			padding: calc($ingredient-shell-padding-x + env(safe-area-inset-top))
				$ingredient-shell-padding-x calc($ingredient-shell-padding-x + env(safe-area-inset-bottom));
		}
	}
</style>
