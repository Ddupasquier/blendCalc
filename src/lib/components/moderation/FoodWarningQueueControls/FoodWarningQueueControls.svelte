<script lang="ts">
	import PaginatedListControls from "$lib/components/common/navigation/PaginatedListControls/PaginatedListControls.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import type { FoodWarningQueueControlsProps } from "./types";
	let {
		label,
		loadedCount,
		total,
		hasMore,
		loading,
		error,
		scrollContainer,
		onLoadMore,
		onRetry,
	}: FoodWarningQueueControlsProps = $props();
</script>

<div
	class="food-warning-queue-controls"
	aria-label={`${label} pagination`}
	aria-busy={loading}
>
	<p role="status" aria-live="polite">
		{loadedCount} of {total}
		{label.toLocaleLowerCase()} loaded{loading ? ". Loading…" : "."}
	</p>
	{#if error}
		<StatusMessage tone="danger" message={error} />
		<RoundedActionButton
			variant="outline"
			disabled={loading}
			onclick={() => void onRetry()}
			>Retry {label.toLocaleLowerCase()}</RoundedActionButton
		>
	{/if}
	<PaginatedListControls
		{scrollContainer}
		hasMoreItems={hasMore}
		loadingMore={loading}
		loadMoreDisabled={loading || Boolean(error)}
		loadMoreLabel={`Load more ${label.toLocaleLowerCase()}`}
		contentVersion={`${loadedCount}:${total}`}
		containerElement="div"
		{onLoadMore}
	/>
</div>

<style lang="scss">
	@use "./FoodWarningQueueControls.scss";
</style>
