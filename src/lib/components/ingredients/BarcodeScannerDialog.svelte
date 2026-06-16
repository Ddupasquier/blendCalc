<script lang="ts">
	import { onMount } from "svelte";
	import CloseButton from "$lib/components/common/CloseButton.svelte";
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
				<div>
					<h2 id="barcode-scanner-title">Scan a package barcode</h2>
					<p id="barcode-scanner-help">
						Hold the barcode steady inside the camera view.
					</p>
				</div>
				<CloseButton label="Close barcode scanner" onclick={close} />
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
		place-items: center;
		padding: $app-gap-md;
		background: $app-overlay-bg;
	}

	.barcode-scanner {
		display: grid;
		gap: $app-gap-md;
		width: min(100%, 32rem);
		padding: $app-gap-md;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;

		header {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: $app-gap-sm;
		}

		h2 {
			color: $app-primary;
			font-family: $app-font-family-display;
			font-size: $app-font-size-xl;
		}

		p {
			color: $app-muted;
			font-size: $app-font-size-md;
			line-height: 1.4;
		}
	}

	.barcode-scanner__camera {
		position: relative;
		min-height: 15rem;
		overflow: hidden;
		background: $color-ink-black;
		border-radius: $app-radius;

		video {
			display: block;
			width: 100%;
			height: 100%;
			min-height: 15rem;
			object-fit: cover;
		}
	}

	.barcode-scanner__target {
		position: absolute;
		inset: 50% auto auto 50%;
		width: min(78%, 24rem);
		height: 7rem;
		border: 3px solid $app-highlight;
		border-radius: $app-radius;
		transform: translate(-50%, -50%);
	}

	.barcode-scanner__status {
		position: absolute;
		inset: auto 50% $app-gap-sm auto;
		padding: 0.35rem 0.6rem;
		color: $app-primary !important;
		background: $app-bg;
		border-radius: $app-radius-pill;
		font-weight: $app-font-weight-bold;
		transform: translateX(50%);
	}

	.barcode-scanner__error {
		padding: $app-gap-sm;
		color: $app-warning-strong !important;
		background: $app-warning-bg;
		border: $app-warning-border;
		border-radius: $app-radius;
	}

	@media (max-width: $app-breakpoint-sm) {
		.barcode-scanner-backdrop {
			padding: $app-gap-sm;
		}

		.barcode-scanner {
			padding: $app-gap-sm;
		}
	}
</style>
