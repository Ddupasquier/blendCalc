<script lang="ts">
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import AccountAccessReviewList from "$lib/components/moderation/AccountAccessReviewList/AccountAccessReviewList.svelte";
	import FoodWarningReportReviewList from "$lib/components/moderation/FoodWarningReportReviewList/FoodWarningReportReviewList.svelte";
	import ProductSubmissionReviewList from "$lib/components/moderation/ProductSubmissionReviewList/ProductSubmissionReviewList.svelte";
	import ProfileImageReportReviewList from "$lib/components/moderation/ProfileImageReportReviewList/ProfileImageReportReviewList.svelte";
	import type { ModerationWorkspaceProps } from "./types";

	let {
		data,
		form = null,
		scope = "all",
	}: ModerationWorkspaceProps = $props();
</script>

<div class="moderation-workspace" data-scope={scope}>
	{#if scope === "all"}
		<header class="moderation-workspace__header">
			<p class="moderation-workspace__eyebrow">{data.viewerRole}</p>
			<h1>Moderation</h1>
			<p>Review shared products, food warnings, reported profile images, and account access.</p>
			<a href="/profile/privileged-tools">Open focused privileged tools</a>
		</header>
	{/if}

	{#if form?.moderationError}
		<StatusMessage tone="danger" message={form.moderationError} />
	{:else if form?.moderationWarning}
		<StatusMessage tone="warning" message={form.moderationWarning} />
	{:else if form?.moderationSuccess}
		<StatusMessage tone="success" message={form.moderationSuccess} />
	{/if}

	{#if scope === "all" || scope === "product-submissions"}
		<ProductSubmissionReviewList
			submissions={data.productSubmissions}
			{form}
			showHeading={scope === "all"}
		/>
	{/if}

	{#if scope === "all" || scope === "food-warning-reports"}
		<FoodWarningReportReviewList
			reports={data.compatibilityFeedback}
			{form}
			showHeading={scope === "all"}
		/>
	{/if}

	{#if scope === "all" || scope === "profile-images"}
		<ProfileImageReportReviewList
			reports={data.profileImageReports}
			{form}
			showHeading={scope === "all"}
		/>
	{/if}

	{#if scope === "all" || scope === "account-access"}
		<AccountAccessReviewList
			users={data.users}
			query={data.query}
			totalCount={data.totalCount}
			viewerUserId={data.viewerUserId}
			viewerRole={data.viewerRole}
			searchPath={scope === "all" ? "/moderation" : "/profile/privileged-tools/account-access"}
			showHeading={scope === "all"}
		/>
	{/if}
</div>

<style lang="scss">
	@use "./ModerationWorkspace.scss";
</style>
