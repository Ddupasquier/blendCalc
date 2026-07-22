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
					<p id="barcode-scanner-help">
						Align the barcode or GS1 product QR code within the frame.
					</p>
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
					<p class="barcode-scanner__hint">
						Align barcode or product QR within the frame
					</p>
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
		background: rgba(0, 0, 0, 0.72);
		overscroll-behavior: contain;
	}

	.barcode-scanner {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		gap: $app-gap-md;
		width: min(100%, $app-shell-content-max-width);
		min-height: 100vh;
		min-height: 100dvh;
		padding: calc($app-shell-padding-y + env(safe-area-inset-top))
			$app-shell-padding-x calc($app-shell-padding-y + env(safe-area-inset-bottom));
		background: #080909;
		border: 0;
		border-radius: 0;

		header {
			display: flex;
			align-items: center;
			justify-content: flex-start;
			gap: $app-gap-sm;
		}

		h2 {
			color: $app-shell-surface-panel;
			font-family: $app-font-family-display;
			font-size: $app-font-size-xl;
			font-weight: $app-font-weight-heavy;
		}

		p {
			color: color-mix(in srgb, $app-shell-surface-panel 52%, transparent);
			font-size: $app-font-size-md;
			line-height: 1.4;
		}
	}

	.barcode-scanner__camera {
		position: relative;
		min-height: 100%;
		overflow: hidden;
		background: #080909;
		border-radius: 0;

		video {
			display: block;
			width: 100%;
			height: 100%;
			min-height: calc(100vh - 8rem);
			object-fit: cover;
		}
	}

	.barcode-scanner__target {
		position: absolute;
		inset: 50% auto auto 50%;
		width: min(66%, 16rem);
		height: 8.7rem;
		border-radius: $app-shell-radius-card;
		background:
			linear-gradient($app-shell-accent-primary, $app-shell-accent-primary) top left /
				3rem 0.18rem no-repeat,
			linear-gradient($app-shell-accent-primary, $app-shell-accent-primary) top left /
				0.18rem 2.3rem no-repeat,
			linear-gradient($app-shell-accent-primary, $app-shell-accent-primary) top right /
				3rem 0.18rem no-repeat,
			linear-gradient($app-shell-accent-primary, $app-shell-accent-primary) top right /
				0.18rem 2.3rem no-repeat,
			linear-gradient($app-shell-accent-primary, $app-shell-accent-primary) bottom left /
				3rem 0.18rem no-repeat,
			linear-gradient($app-shell-accent-primary, $app-shell-accent-primary) bottom left /
				0.18rem 2.3rem no-repeat,
			linear-gradient($app-shell-accent-primary, $app-shell-accent-primary) bottom right /
				3rem 0.18rem no-repeat,
			linear-gradient($app-shell-accent-primary, $app-shell-accent-primary) bottom right /
				0.18rem 2.3rem no-repeat,
			color-mix(in srgb, $app-shell-accent-primary 6%, transparent);
		transform: translate(-50%, -50%);
	}

	.barcode-scanner__status,
	.barcode-scanner__hint {
		position: absolute;
		inset: calc(50% + 5.6rem) 50% auto auto;
		width: max-content;
		max-width: 80%;
		color: color-mix(in srgb, $app-shell-surface-panel 58%, transparent) !important;
		text-align: center;
		transform: translateX(50%);
	}

	.barcode-scanner__status {
		padding: 0.55rem 0.85rem;
		color: $app-shell-accent-primary !important;
		background: rgba($app-shell-surface-panel, 0.08);
		border-radius: $app-shell-radius-pill;
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
			padding: calc($app-shell-padding-x + env(safe-area-inset-top))
				$app-shell-padding-x calc($app-shell-padding-x + env(safe-area-inset-bottom));
		}
	}
</style>
