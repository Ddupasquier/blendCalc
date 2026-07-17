<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton.svelte";
	import type { ScrollListReturnToTopProps } from "$lib/components/common/navigation/types";
	import { getMotionSafeScrollBehavior } from "$lib/utils/accessibility/motion";

	let {
		scrollContainer,
		hasMoreItems = false,
		contentVersion = 0,
	}: ScrollListReturnToTopProps = $props();

	let listOverflows = $state(false);

	const updateOverflow = () => {
		listOverflows = Boolean(
			scrollContainer &&
				scrollContainer.scrollHeight > scrollContainer.clientHeight,
		);
	};

	const returnToTop = () => {
		scrollContainer?.scrollTo({
			top: 0,
			behavior: getMotionSafeScrollBehavior(),
		});
	};

	$effect(() => {
		void contentVersion;
		void hasMoreItems;

		const root = scrollContainer;
		if (!root) {
			listOverflows = false;
			return;
		}

		const frame = requestAnimationFrame(updateOverflow);
		const observer =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(updateOverflow);

		observer?.observe(root);
		window.addEventListener("resize", updateOverflow);

		return () => {
			cancelAnimationFrame(frame);
			observer?.disconnect();
			window.removeEventListener("resize", updateOverflow);
		};
	});
</script>

{#if listOverflows && !hasMoreItems}
	<li class="scroll-list-return-to-top">
		<RoundedActionButton variant="outline" onclick={returnToTop}>
			Return to top
		</RoundedActionButton>
	</li>
{/if}

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.scroll-list-return-to-top {
		display: grid;
		place-items: center;
		min-width: 0;
		padding: $app-gap-sm 0;
	}
</style>
