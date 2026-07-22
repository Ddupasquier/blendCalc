<script lang="ts">
	import { onMount } from "svelte";
	import BackButton from "$lib/components/common/buttons/BackButton/BackButton.svelte";
	import type { BarcodeScannerDialogProps } from "./types";
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
	@use "./BarcodeScannerDialog.scss";
</style>
