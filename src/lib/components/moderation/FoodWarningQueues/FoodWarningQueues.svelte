<script lang="ts">
	import { untrack, tick } from "svelte";
	import FoodWarningFollowUpList from "$lib/components/moderation/FoodWarningFollowUpList/FoodWarningFollowUpList.svelte";
	import FoodWarningReportReviewList from "$lib/components/moderation/FoodWarningReportReviewList/FoodWarningReportReviewList.svelte";
	import FoodWarningQueueControls from "$lib/components/common/navigation/ProgressiveListFooter/ProgressiveListFooter.svelte";
	import {
		createFoodWarningQueueController,
		fetchFoodWarningQueuePage,
	} from "./foodWarningQueueController.svelte";
	import type { FoodWarningQueuesProps } from "./types";
	import type { FoodWarningQueueRows } from "$lib/utils/moderation/foodWarningQueuePagination";

	let {
		pages,
		form = null,
		scrollContainer,
		onTotalsChange = () => {},
	}: FoodWarningQueuesProps = $props();
	const reports = createFoodWarningQueueController<
		FoodWarningQueueRows["reports"]
	>(
		untrack(() => pages.reports),
		(cursor, signal) => fetchFoodWarningQueuePage("reports", cursor, signal),
	);
	const productCorrections = createFoodWarningQueueController<
		FoodWarningQueueRows["productCorrections"]
	>(
		untrack(() => pages.productCorrections),
		(cursor, signal) =>
			fetchFoodWarningQueuePage("productCorrections", cursor, signal),
	);
	const policyReviews = createFoodWarningQueueController<
		FoodWarningQueueRows["policyReviews"]
	>(
		untrack(() => pages.policyReviews),
		(cursor, signal) =>
			fetchFoodWarningQueuePage("policyReviews", cursor, signal),
	);
	let previousPages = untrack(() => pages);

	const preserveScroll = async (action: () => Promise<void>) => {
		const root = scrollContainer;
		const position = root?.scrollTop;
		await action();
		await tick();
		if (root && position !== undefined) root.scrollTop = position;
	};

	$effect(() => {
		const currentPages = pages;
		if (currentPages === previousPages) return;
		previousPages = currentPages;
		void untrack(() =>
			preserveScroll(async () => {
				await Promise.all([
					reports.refresh(currentPages.reports),
					productCorrections.refresh(currentPages.productCorrections),
					policyReviews.refresh(currentPages.policyReviews),
				]);
			}),
		);
	});
	$effect(() => {
		onTotalsChange({
			reports: reports.state.total,
			followUps: productCorrections.state.total + policyReviews.state.total,
		});
	});
	$effect(() => () => {
		reports.destroy();
		productCorrections.destroy();
		policyReviews.destroy();
	});
</script>

<FoodWarningReportReviewList
	reports={reports.state.items}
	totalCount={reports.state.total}
	refreshing={reports.state.refreshing || reports.needsRefresh}
	{form}
/>
{#if reports.state.items.length > 0 || reports.state.error}
	<FoodWarningQueueControls
		label="Reports"
		loadedCount={reports.state.items.length}
		total={reports.state.total}
		hasMore={reports.state.nextCursor !== null}
		loading={reports.state.loading || reports.state.refreshing}
		error={reports.state.error}
		{scrollContainer}
		onLoadMore={() => preserveScroll(reports.loadMore)}
		onRetry={() =>
			preserveScroll(reports.needsRefresh ? reports.refresh : reports.loadMore)}
	/>
{/if}
<FoodWarningFollowUpList
	followUps={{
		productCorrections: productCorrections.state.items,
		policyReviews: policyReviews.state.items,
	}}
	productCorrectionTotal={productCorrections.state.total}
	policyReviewTotal={policyReviews.state.total}
>
	{#snippet productCorrectionControls()}
		<FoodWarningQueueControls
			label="Product corrections"
			loadedCount={productCorrections.state.items.length}
			total={productCorrections.state.total}
			hasMore={productCorrections.state.nextCursor !== null}
			loading={productCorrections.state.loading ||
				productCorrections.state.refreshing}
			error={productCorrections.state.error}
			{scrollContainer}
			onLoadMore={() => preserveScroll(productCorrections.loadMore)}
			onRetry={() =>
				preserveScroll(
					productCorrections.needsRefresh
						? productCorrections.refresh
						: productCorrections.loadMore,
				)}
		/>
	{/snippet}
	{#snippet policyReviewControls()}
		<FoodWarningQueueControls
			label="Policy and source reviews"
			loadedCount={policyReviews.state.items.length}
			total={policyReviews.state.total}
			hasMore={policyReviews.state.nextCursor !== null}
			loading={policyReviews.state.loading || policyReviews.state.refreshing}
			error={policyReviews.state.error}
			{scrollContainer}
			onLoadMore={() => preserveScroll(policyReviews.loadMore)}
			onRetry={() =>
				preserveScroll(
					policyReviews.needsRefresh
						? policyReviews.refresh
						: policyReviews.loadMore,
				)}
		/>
	{/snippet}
</FoodWarningFollowUpList>
