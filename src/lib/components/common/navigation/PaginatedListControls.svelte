<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import type { PaginatedListControlsProps } from "$lib/components/common/navigation/types";
	import { getMotionSafeScrollBehavior } from "$lib/utils/accessibility/motion";

	let {
		scrollContainer,
		hasMoreItems = false,
		loadingMore = false,
		loadMoreDisabled = false,
		loadMoreLabel = "Load more",
		contentVersion = 0,
		containerElement = "li",
		onLoadMore = () => {},
	}: PaginatedListControlsProps = $props();

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

{#if hasMoreItems || listOverflows}
	<svelte:element
		this={containerElement}
		class="paginated-list-controls"
		class:paginated-list-controls--paired={hasMoreItems && listOverflows}
	>
		{#if hasMoreItems}
			<RoundedActionButton
				variant="soft"
				fullWidth
				busy={loadingMore}
				disabled={loadMoreDisabled}
				onclick={() => void onLoadMore()}
			>
				{loadMoreLabel}
			</RoundedActionButton>
		{/if}

		{#if listOverflows}
			<RoundedActionButton
				variant="outline"
				fullWidth
				onclick={returnToTop}
			>
				Return to top
			</RoundedActionButton>
		{/if}
	</svelte:element>
{/if}

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.paginated-list-controls {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: $app-gap-md;
		min-width: 0;
	}

	.paginated-list-controls--paired {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	@media (max-width: $app-breakpoint-xs) {
		.paginated-list-controls--paired {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
