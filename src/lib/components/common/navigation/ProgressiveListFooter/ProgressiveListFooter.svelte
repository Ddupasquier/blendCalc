<script lang="ts">
	import { tick } from "svelte";
	import PaginatedListControls from "$lib/components/common/navigation/PaginatedListControls/PaginatedListControls.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import type { ProgressiveListFooterProps } from "./types";
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
	}: ProgressiveListFooterProps = $props();
	let footer = $state<HTMLDivElement | null>(null);
	const keepKeyboardFocus = async (action: () => void | Promise<void>) => {
		const active = document.activeElement;
		const focused =
			active instanceof HTMLElement && footer?.contains(active) ? active : null;
		await action();
		await tick();
		if (
			!focused ||
			(document.activeElement !== document.body &&
				document.activeElement !== focused)
		)
			return;
		const target =
			focused.isConnected && !focused.matches(":disabled")
				? focused
				: footer?.querySelector<HTMLButtonElement>("button:not(:disabled)");
		target?.focus({ preventScroll: true });
	};
</script>

<div
	bind:this={footer}
	class="progressive-list-footer"
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
			onclick={() => void keepKeyboardFocus(onRetry)}
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
		onLoadMore={() => keepKeyboardFocus(onLoadMore)}
	/>
</div>

<style lang="scss">
	@use "./ProgressiveListFooter.scss";
</style>
