<script lang="ts">
	import Barcode from "$lib/assets/icons/Barcode.svelte";
	import type { BarcodeScannerIconProps } from "$lib/components/ingredients/barcode/types";

	const barcodeBars = [
		2, 2, 6, 1, 9, 3, 14, 1, 17, 2, 21, 1, 24, 3, 29, 1, 32, 2, 36, 1, 39,
		3, 44, 2,
	];
	const barcodeBarIndexes = Array.from(
		{ length: barcodeBars.length / 2 },
		(_, index) => index,
	);

	let {
		active = false,
	}: BarcodeScannerIconProps = $props();
</script>

<span class="barcode-scanner" class:barcode-scanner--active={active} aria-hidden="true">
	{#if active}
		<span class="barcode-scanner__bracket barcode-scanner__bracket--top-left"></span>
		<span class="barcode-scanner__bracket barcode-scanner__bracket--top-right"></span>
		<span class="barcode-scanner__bracket barcode-scanner__bracket--bottom-left"></span>
		<span class="barcode-scanner__bracket barcode-scanner__bracket--bottom-right"></span>
		<svg
			class="barcode-scanner__bars"
			viewBox="0 0 48 28"
			width="48"
			height="28"
		>
			{#each barcodeBarIndexes as index}
				<rect
					x={barcodeBars[index * 2]}
					y="0"
					width={barcodeBars[index * 2 + 1]}
					height="28"
					fill="currentColor"
				/>
			{/each}
		</svg>
		<span class="barcode-scanner__glow"></span>
		<span class="barcode-scanner__laser"></span>
	{:else}
		<Barcode class="barcode-scanner__idle-bars" />
	{/if}
</span>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.barcode-scanner {
		position: relative;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 1.125rem;
		height: 1rem;
		overflow: hidden;
		background-color: transparent;
		border-radius: 0.5rem;
		transition:
			width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
			height 0.25s cubic-bezier(0.4, 0, 0.2, 1),
			background-color 0.28s ease,
			color 0.28s ease;
	}

	.barcode-scanner--active {
		width: 3.5rem;
		height: 2.25rem;
		color: color-mix(in srgb, $app-shell-surface-panel 22%, transparent);
		background-color: color-mix(
			in srgb,
			$app-shell-text-primary 84%,
			$app-shell-accent-primary
		);
	}

	:global(.barcode-scanner__idle-bars) {
		display: block;
		fill: currentColor;
	}

	.barcode-scanner__bracket {
		position: absolute;
		z-index: 2;
		width: 0.375rem;
		height: 0.375rem;
		border-color: #e45f55;
		border-style: solid;
		opacity: 0;
		animation: scanner-detail-fade-in 0.22s ease forwards;
	}

	.barcode-scanner__bracket--top-left {
		top: 0.2rem;
		left: 0.2rem;
		border-width: 1.5px 0 0
			1.5px;
	}

	.barcode-scanner__bracket--top-right {
		top: 0.2rem;
		right: 0.2rem;
		border-width: 1.5px
			1.5px 0 0;
	}

	.barcode-scanner__bracket--bottom-left {
		bottom: 0.2rem;
		left: 0.2rem;
		border-width: 0 0 1.5px
			1.5px;
	}

	.barcode-scanner__bracket--bottom-right {
		right: 0.2rem;
		bottom: 0.2rem;
		border-width: 0 1.5px
			1.5px 0;
	}

	.barcode-scanner__bars {
		position: absolute;
		top: 0.25rem;
		display: block;
		color: $app-shell-surface-panel;
		opacity: 0;
		animation: scanner-detail-fade-in 0.22s ease forwards;
	}

	.barcode-scanner__glow {
		position: absolute;
		right: 0;
		left: 0;
		height: 0.6rem;
		opacity: 0;
		pointer-events: none;
		background: radial-gradient(
			ellipse at center,
			rgba(#e45f55, 0.46) 0%,
			rgba(#e45f55, 0.18) 42%,
			transparent 76%
		);
		animation:
			scanner-detail-fade-in 0.22s ease forwards,
			barcode-laser-glow 1.1s ease-in-out infinite;
	}

	.barcode-scanner__laser {
		position: absolute;
		right: 0;
		left: 0;
		height: 2px;
		opacity: 0;
		pointer-events: none;
		background: linear-gradient(
			90deg,
			transparent 0%,
			#e45f55 8%,
			#e45f55 92%,
			transparent 100%
		);
		filter: drop-shadow(0 0 3px rgba(#e45f55, 0.9));
		animation:
			scanner-detail-fade-in 0.22s ease forwards,
			barcode-laser-sweep 1.1s ease-in-out infinite;
	}

	@keyframes scanner-detail-fade-in {
		from {
			opacity: 0;
		}

		to {
			opacity: 1;
		}
	}

	@keyframes barcode-laser-sweep {
		0% {
			top: 0.25rem;
		}

		45%,
		55% {
			top: 1.75rem;
		}

		100% {
			top: 0.25rem;
		}
	}

	@keyframes barcode-laser-glow {
		0% {
			top: -0.2rem;
		}

		45%,
		55% {
			top: 1.3rem;
		}

		100% {
			top: -0.2rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.barcode-scanner {
			transition: none;
		}

		.barcode-scanner__glow,
		.barcode-scanner__laser {
			animation: none;
		}
	}
</style>
