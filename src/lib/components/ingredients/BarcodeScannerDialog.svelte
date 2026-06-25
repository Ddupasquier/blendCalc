<script lang="ts">
	import ArrowLeft from "$lib/assets/icons/ArrowLeft.svelte";
	import { onMount } from "svelte";
	import {
		isNativeBarcodePlatform,
		scanNativeBarcode,
		startWebBarcodeScanner,
	} from "$lib/utils/barcode/scanner";
	import type {
		BarcodeScanResult,
		BarcodeScannerStop,
	} from "$lib/utils/barcode/types";

	let {
		open,
		onDetected,
		onClose,
	}: {
		open: boolean;
		onDetected: (result: BarcodeScanResult) => void;
		onClose: () => void;
	} = $props();

	let video = $state<HTMLVideoElement>();
	let stopScanner: BarcodeScannerStop | null = null;
	let error = $state("");
	let starting = $state(true);

	const close = () => {
		stopScanner?.();
		stopScanner = null;
		onClose();
	};

	onMount(() => {
		if (!open) return;
		let cancelled = false;

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
			class="barcode-scanner"
			role="dialog"
			aria-modal="true"
			aria-labelledby="barcode-scanner-title"
			aria-describedby="barcode-scanner-help"
		>
			<header>
				<button
					class="barcode-scanner__back"
					type="button"
					aria-label="Close barcode scanner"
					onclick={close}
				>
					<ArrowLeft class="barcode-scanner__back-icon" />
				</button>
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
	@use "../../../styles/variables" as *;

	.barcode-scanner-backdrop {
		position: fixed;
		z-index: 1000;
		inset: 0;
		display: grid;
		place-items: stretch center;
		padding: 0;
		background: $app-rebuild-scanner-overlay-bg;
	}

	.barcode-scanner {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		gap: $app-gap-md;
		width: min(100%, $app-mobile-shell-width);
		min-height: 100vh;
		padding: calc($app-shell-padding-y + env(safe-area-inset-top)) $app-shell-padding-x
			calc($app-shell-padding-y + env(safe-area-inset-bottom));
		background: $app-rebuild-scanner-bg;
		border: 0;
		border-radius: 0;

		header {
			display: flex;
			align-items: center;
			justify-content: flex-start;
			gap: $app-gap-sm;
		}

		h2 {
			color: $color-figma-card;
			font-family: $app-font-family-display;
			font-size: $app-font-size-xl;
			font-weight: $app-font-weight-heavy;
		}

		p {
			color: color-mix(in srgb, $color-figma-card 52%, transparent);
			font-size: $app-font-size-md;
			line-height: 1.4;
		}
	}

	.barcode-scanner__back {
		display: inline-grid;
		place-items: center;
		width: $app-rebuild-scanner-back-size;
		height: $app-rebuild-scanner-back-size;
		padding: 0;
		color: $color-figma-card;
		background: color-mix(in srgb, $color-figma-card 10%, transparent);
		border: 0;
		border-radius: $app-rebuild-radius-pill;
		font-size: 1.45rem;
		line-height: 1;
	}

	:global(.barcode-scanner__back-icon) {
		width: $app-gap-lg;
		height: $app-gap-lg;
	}

	.barcode-scanner__camera {
		position: relative;
		min-height: 100%;
		overflow: hidden;
		background: $app-rebuild-scanner-bg;
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
		width: min($app-rebuild-scanner-target-width, $app-rebuild-scanner-target-max-width);
		height: $app-rebuild-scanner-target-height;
		border-radius: $app-rebuild-radius;
		background:
			linear-gradient($color-figma-green, $color-figma-green) top left /
				$app-rebuild-scanner-target-corner-long $app-rebuild-scanner-target-corner-thickness no-repeat,
			linear-gradient($color-figma-green, $color-figma-green) top left /
				$app-rebuild-scanner-target-corner-thickness $app-rebuild-scanner-target-corner-short no-repeat,
			linear-gradient($color-figma-green, $color-figma-green) top right /
				$app-rebuild-scanner-target-corner-long $app-rebuild-scanner-target-corner-thickness no-repeat,
			linear-gradient($color-figma-green, $color-figma-green) top right /
				$app-rebuild-scanner-target-corner-thickness $app-rebuild-scanner-target-corner-short no-repeat,
			linear-gradient($color-figma-green, $color-figma-green) bottom left /
				$app-rebuild-scanner-target-corner-long $app-rebuild-scanner-target-corner-thickness no-repeat,
			linear-gradient($color-figma-green, $color-figma-green) bottom left /
				$app-rebuild-scanner-target-corner-thickness $app-rebuild-scanner-target-corner-short no-repeat,
			linear-gradient($color-figma-green, $color-figma-green) bottom right /
				$app-rebuild-scanner-target-corner-long $app-rebuild-scanner-target-corner-thickness no-repeat,
			linear-gradient($color-figma-green, $color-figma-green) bottom right /
				$app-rebuild-scanner-target-corner-thickness $app-rebuild-scanner-target-corner-short no-repeat,
			color-mix(in srgb, $color-figma-green 6%, transparent);
		transform: translate(-50%, -50%);
	}

	.barcode-scanner__status,
	.barcode-scanner__hint {
		position: absolute;
		inset: calc(50% + $app-rebuild-scanner-status-offset) 50% auto auto;
		width: max-content;
		max-width: 80%;
		color: color-mix(in srgb, $color-figma-card 58%, transparent) !important;
		text-align: center;
		transform: translateX(50%);
	}

	.barcode-scanner__status {
		padding: 0.55rem 0.85rem;
		color: $color-figma-green !important;
		background: rgba($color-figma-card, 0.08);
		border-radius: $app-rebuild-radius-pill;
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
			padding: calc($app-shell-padding-x + env(safe-area-inset-top)) $app-shell-padding-x
				calc($app-shell-padding-x + env(safe-area-inset-bottom));
		}
	}
</style>
