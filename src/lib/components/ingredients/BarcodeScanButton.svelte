<script lang="ts">
	import Barcode from "$lib/assets/icons/Barcode.svelte";

	const barcodeBars = [
		2, 2, 6, 1, 9, 3, 14, 1, 17, 2, 21, 1, 24, 3, 29, 1, 32, 2, 36, 1, 39,
		3, 44, 2,
	];
	const barcodeBarIndexes = Array.from(
		{ length: barcodeBars.length / 2 },
		(_, index) => index,
	);

	let {
		scanning = false,
		disabled = false,
		compact = false,
		onclick,
	}: {
		scanning?: boolean;
		disabled?: boolean;
		compact?: boolean;
		onclick: () => void;
	} = $props();
</script>

<button
	class="barcode-scan-button"
	class:barcode-scan-button--loading={scanning}
	class:barcode-scan-button--compact={compact}
	type="button"
	disabled={disabled || scanning}
	aria-busy={scanning}
	aria-label={scanning ? "Scanning barcode" : "Scan barcode"}
	{onclick}
>
	<span
		class="barcode-scanner"
		class:barcode-scanner--active={scanning}
		aria-hidden="true"
	>
		{#if scanning}
			<span
				class="barcode-scanner__bracket barcode-scanner__bracket--top-left"
			></span>
			<span
				class="barcode-scanner__bracket barcode-scanner__bracket--top-right"
			></span>
			<span
				class="barcode-scanner__bracket barcode-scanner__bracket--bottom-left"
			></span>
			<span
				class="barcode-scanner__bracket barcode-scanner__bracket--bottom-right"
			></span>
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
	<span class="barcode-scan-button__label">{scanning ? "Scanning..." : "Scan"}</span>
</button>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.barcode-scan-button {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		gap: $app-gap-xs;
		width: auto;
		min-height: $app-rebuild-control-height;
		padding: $app-rebuild-scan-button-padding-y $app-rebuild-scan-button-padding-x;
		color: $color-figma-card;
		background-color: $color-figma-green;
		border: 0;
		border-radius: $app-rebuild-radius;
		transition:
			background-color 0.28s ease,
			color 0.28s ease,
			min-height 0.24s ease,
			padding 0.24s ease,
			border-radius 0.24s ease;

		.barcode-scan-button__label {
			position: relative;
			z-index: 1;
			white-space: nowrap;
		}

		&:hover:not(:disabled) {
			background-color: color-mix(in srgb, $color-figma-green 88%, $color-figma-ink);
		}

		&:disabled {
			cursor: wait;
			opacity: 1;
		}
	}

	.barcode-scan-button--loading {
		min-height: $app-rebuild-scan-button-loading-height;
		padding: $app-rebuild-scan-button-loading-padding-y $app-rebuild-scan-button-loading-padding-x;
		color: $app-scan-laser;
		background-color: color-mix(in srgb, $color-figma-green 58%, $color-figma-ink);
		border-radius: $app-rebuild-radius;
	}

	.barcode-scan-button--compact {
		width: $app-rebuild-control-height;
		height: $app-rebuild-control-height;
		min-height: $app-rebuild-control-height;
		padding: 0;
		flex-shrink: 0;

		.barcode-scan-button__label {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}
	}

	.barcode-scan-button--compact.barcode-scan-button--loading {
		width: $app-rebuild-scan-button-loading-width;
		height: $app-rebuild-scan-button-loading-height;
	}

	.barcode-scanner {
		position: relative;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: $app-rebuild-scan-icon-width;
		height: $app-rebuild-scan-icon-height;
		overflow: hidden;
		border-radius: 0.5rem;
		background-color: transparent;
		transition:
			width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
			height 0.25s cubic-bezier(0.4, 0, 0.2, 1),
			background-color 0.28s ease,
			color 0.28s ease;
	}

	.barcode-scanner--active {
		width: $app-rebuild-scan-icon-active-width;
		height: $app-rebuild-scan-icon-active-height;
		color: color-mix(in srgb, $color-figma-card 22%, transparent);
		background-color: color-mix(in srgb, $color-figma-ink 84%, $color-figma-green);
	}

	.barcode-scan-button--loading .barcode-scan-button__label {
		color: $app-scan-laser;
		transition: color 0.28s ease;
	}

	:global(.barcode-scanner__idle-bars) {
		display: block;
		fill: currentColor;
	}

	.barcode-scanner__bracket {
		position: absolute;
		z-index: 2;
		width: $app-rebuild-scan-bracket-size;
		height: $app-rebuild-scan-bracket-size;
		border-color: $app-scan-laser;
		border-style: solid;
		opacity: 0;
		animation: scanner-detail-fade-in 0.22s ease forwards;
	}

	.barcode-scanner__bracket--top-left {
		top: 0.2rem;
		left: 0.2rem;
		border-width: 1.5px 0 0 1.5px;
	}

	.barcode-scanner__bracket--top-right {
		top: 0.2rem;
		right: 0.2rem;
		border-width: 1.5px 1.5px 0 0;
	}

	.barcode-scanner__bracket--bottom-left {
		bottom: 0.2rem;
		left: 0.2rem;
		border-width: 0 0 1.5px 1.5px;
	}

	.barcode-scanner__bracket--bottom-right {
		right: 0.2rem;
		bottom: 0.2rem;
		border-width: 0 1.5px 1.5px 0;
	}

	.barcode-scanner__bars {
		position: absolute;
		top: 0.25rem;
		display: block;
		color: $color-figma-card;
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
			rgba($app-scan-laser, 0.46) 0%,
			rgba($app-scan-laser, 0.18) 42%,
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
			$app-scan-laser 8%,
			$app-scan-laser 92%,
			transparent 100%
		);
		filter: drop-shadow(0 0 3px rgba($app-scan-laser, 0.9));
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
		.barcode-scan-button,
		.barcode-scanner {
			transition: none;
		}

		.barcode-scanner__glow,
		.barcode-scanner__laser {
			animation: none;
		}
	}
</style>
