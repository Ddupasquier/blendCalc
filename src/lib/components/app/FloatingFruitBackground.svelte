<script lang="ts">
	import { onMount } from "svelte";
	import FruitIcon from "$lib/components/illustrations/fruit/FruitIcon.svelte";
	import {
		advanceFloatingFruits,
		createFloatingFruits,
		type AnimationBounds,
		type FloatingFruit,
		type PlacementFocus,
	} from "$lib/utils/animation/floatingFruit";

	let { focusElement }: { focusElement?: HTMLElement } = $props();
	let container: HTMLDivElement;
	let fruits = $state<FloatingFruit[]>([]);
	let bounds: AnimationBounds = { width: 0, height: 0 };
	let placementFocus: PlacementFocus | undefined;

	onMount(() => {
		const compactQuery = window.matchMedia("(max-width: 520px)");
		const reducedMotionQuery = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		);
		let animationFrame = 0;
		let setupFrame = 0;
		let previousTimestamp = 0;
		let initializedCompact: boolean | undefined;

		const getPlacementFocus = (): PlacementFocus | undefined => {
			if (!focusElement) return undefined;
			const containerRect = container.getBoundingClientRect();
			const focusRect = focusElement.getBoundingClientRect();
			return {
				x: focusRect.left - containerRect.left,
				y: focusRect.top - containerRect.top,
				width: focusRect.width,
				height: focusRect.height,
			};
		};

		const initializeFruits = (force = false) => {
			bounds = {
				width: container.clientWidth,
				height: container.clientHeight,
			};
			placementFocus = getPlacementFocus();
			if (
				!force &&
				fruits.length > 0 &&
				initializedCompact === compactQuery.matches
			) {
				return;
			}
			fruits = createFloatingFruits(
				bounds,
				compactQuery.matches,
				placementFocus,
			);
			initializedCompact = compactQuery.matches;
		};

		const animate = (timestamp: number) => {
			if (previousTimestamp > 0) {
				advanceFloatingFruits(
					fruits,
						bounds,
						(timestamp - previousTimestamp) / 1000,
						placementFocus,
					);
			}
			previousTimestamp = timestamp;
			animationFrame = requestAnimationFrame(animate);
		};

		const startAnimation = () => {
			cancelAnimationFrame(animationFrame);
			previousTimestamp = 0;
			if (!reducedMotionQuery.matches) {
				animationFrame = requestAnimationFrame(animate);
			}
		};

		const handlePreferenceChange = () => {
			initializeFruits(true);
			startAnimation();
		};

		const resizeObserver = new ResizeObserver(() => initializeFruits());
		compactQuery.addEventListener("change", handlePreferenceChange);
		reducedMotionQuery.addEventListener("change", handlePreferenceChange);
		setupFrame = requestAnimationFrame(() => {
			initializeFruits(true);
			startAnimation();
			resizeObserver.observe(container);
			if (focusElement) resizeObserver.observe(focusElement);
		});

		return () => {
			cancelAnimationFrame(setupFrame);
			cancelAnimationFrame(animationFrame);
			resizeObserver.disconnect();
			compactQuery.removeEventListener("change", handlePreferenceChange);
			reducedMotionQuery.removeEventListener("change", handlePreferenceChange);
		};
	});
</script>

<div class="fruit-background" bind:this={container} aria-hidden="true">
	{#each fruits as fruit (fruit.id)}
		<div
			class="fruit"
			style:width={`${fruit.size}px`}
			style:height={`${fruit.size}px`}
			style:transform={`translate3d(${fruit.x}px, ${fruit.y}px, 0) rotate(${fruit.rotation}deg)`}
		>
			<FruitIcon name={fruit.name} />
		</div>
	{/each}
</div>

<style lang="scss">
	.fruit-background {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		user-select: none;
	}

	.fruit {
		position: absolute;
		top: 0;
		left: 0;
		display: block;
		opacity: 0.42;
		will-change: transform;
		filter: saturate(0.88);
	}

	.fruit :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
		stroke: currentColor;
		stroke-width: 1.25px;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.fruit :global(path) {
		vector-effect: non-scaling-stroke;
	}

	@media (prefers-reduced-motion: reduce) {
		.fruit {
			opacity: 0.3;
			will-change: auto;
		}
	}
</style>
