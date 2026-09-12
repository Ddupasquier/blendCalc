<script lang="ts">
	import BrandCup from "$lib/assets/icons/BrandCup/BrandCup.svelte";
	import ShieldCheck from "$lib/assets/icons/ShieldCheck/ShieldCheck.svelte";
	import Sliders from "$lib/assets/icons/Sliders/Sliders.svelte";
	import User from "$lib/assets/icons/User/User.svelte";
	import WarningTriangle from "$lib/assets/icons/WarningTriangle/WarningTriangle.svelte";
	import ActionRequiredCountBadge from "$lib/components/common/badges/ActionRequiredCountBadge/ActionRequiredCountBadge.svelte";
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import CatalogDataOperationsDashboard from "$lib/components/moderation/CatalogDataOperationsDashboard/CatalogDataOperationsDashboard.svelte";
	import PrivilegedProductLookup from "$lib/components/moderation/PrivilegedProductLookup/PrivilegedProductLookup.svelte";
	import ProfilePrivilegedToolLink from "$lib/components/profile/ProfilePrivilegedToolLink/ProfilePrivilegedToolLink.svelte";
	import {
		getProfileSettingsRouteHref,
		PROFILE_SETTINGS_ROUTES,
	} from "$lib/utils/profile/profileRouteState";
	import {
		hasAppPermission,
		PROFILE_PRIVILEGED_TOOL_PERMISSIONS,
	} from "$lib/utils/moderation/profilePrivilegedTools";
	import type { ProfilePrivilegedToolsDashboardProps } from "./types";

	let {
		access,
		diagnostics,
		diagnosticsUnavailable,
	}: ProfilePrivilegedToolsDashboardProps = $props();
	const summary = $derived(access.reviewSummary);
	const canReviewProducts = $derived(
		hasAppPermission(
			access.permissions,
			PROFILE_PRIVILEGED_TOOL_PERMISSIONS.catalogReview,
		),
	);
	const canReviewWarnings = $derived(
		hasAppPermission(
			access.permissions,
			PROFILE_PRIVILEGED_TOOL_PERMISSIONS.warningReview,
		),
	);
	const canManageAccounts = $derived(
		hasAppPermission(
			access.permissions,
			PROFILE_PRIVILEGED_TOOL_PERMISSIONS.accountManagement,
		),
	);
	const canReadDataOperations = $derived(
		hasAppPermission(
			access.permissions,
			PROFILE_PRIVILEGED_TOOL_PERMISSIONS.dataOperationsRead,
		),
	);
	const foodWarningActionCount = $derived(
		summary.pendingFoodWarningReports === null ||
			summary.pendingFoodWarningFollowUps === null
			? null
			: summary.pendingFoodWarningReports + summary.pendingFoodWarningFollowUps,
	);
	const hasActions = (count: number | null) =>
		typeof count === "number" && count > 0;
	const hasActionableWork = $derived(
		!summary.unavailable && (summary.totalActionableItems ?? 0) > 0,
	);
	const firstPriorityLabel = $derived(
		canReviewWarnings && hasActions(foodWarningActionCount)
			? "food warning reports"
			: canReviewProducts && hasActions(summary.pendingCatalogReviewItems)
				? "catalog review work"
				: canReviewProducts && hasActions(summary.pendingProductSubmissions)
					? "product submissions"
					: canManageAccounts && hasActions(summary.pendingProfileImageReviews)
						? "reported profile images"
						: "catalog data operations",
	);
	const overviewTitle = $derived(
		summary.unavailable
			? "Queue status is temporarily unavailable"
			: hasActionableWork
				? `${summary.totalActionableItems} ${summary.totalActionableItems === 1 ? "action needs" : "actions need"} attention`
				: "You're all caught up",
	);
	const overviewDescription = $derived(
		summary.unavailable
			? "Standing tools and system diagnostics remain available. Queue totals are unknown, not zero."
			: hasActionableWork
				? `Start with ${firstPriorityLabel}. Red badges identify work that needs a human decision or repair.`
				: "No human decisions are waiting. System diagnostics and standing tools remain available.",
	);

	const describeQueue = (count: number | null) => {
		if (count === null) return "Review count is temporarily unavailable";
		if (count === 0) return "Nothing is waiting for review";
		return count === 1
			? "1 item is waiting for review"
			: `${count} items are waiting for review`;
	};
	const describeFoodWarningQueue = () => {
		if (foodWarningActionCount === null) {
			return "Review count is temporarily unavailable";
		}
		if (foodWarningActionCount === 0) return "Nothing is waiting for review";
		const parts = [];
		if ((summary.pendingFoodWarningReports ?? 0) > 0) {
			parts.push(
				`${summary.pendingFoodWarningReports} ${summary.pendingFoodWarningReports === 1 ? "report" : "reports"}`,
			);
		}
		if ((summary.pendingFoodWarningFollowUps ?? 0) > 0) {
			parts.push(
				`${summary.pendingFoodWarningFollowUps} ${summary.pendingFoodWarningFollowUps === 1 ? "follow-up" : "follow-ups"}`,
			);
		}
		return `${parts.join(" · ")} waiting`;
	};
</script>

<div class="profile-privileged-tools-dashboard">
	<aside class="profile-privileged-tools-dashboard__tools">
		<PrivilegedProductLookup />
	</aside>

	<div class="profile-privileged-tools-dashboard__main">
		<section
			class="profile-privileged-tools-dashboard__overview"
			data-tone={summary.unavailable
				? "unavailable"
				: hasActionableWork
					? "attention"
					: "clear"}
			aria-live="polite"
		>
			<header>
				<span>{hasActionableWork ? "Work requiring you" : "Work status"}</span>
				{#if hasActionableWork}
					<ActionRequiredCountBadge
						count={summary.totalActionableItems ?? 0}
						label="privileged actions requiring attention"
					/>
				{:else}
					<TextBadge
						label={summary.unavailable ? "Unknown" : "0 waiting"}
						tone={summary.unavailable ? "warning" : "success"}
					/>
				{/if}
			</header>
			<strong>{overviewTitle}</strong>
			<p>{overviewDescription}</p>
		</section>

		{#if hasActionableWork}
			<section
				class="profile-privileged-tools-dashboard__section"
				aria-labelledby="privileged-tools-attention-title"
			>
				<header>
					<h2 id="privileged-tools-attention-title">Needs attention</h2>
					<p>Open the highest-priority workspaces first.</p>
				</header>
				<div class="profile-privileged-tools-dashboard__link-grid">
					{#if canReviewWarnings && hasActions(foodWarningActionCount)}
						<ProfilePrivilegedToolLink
							href={getProfileSettingsRouteHref(
								PROFILE_SETTINGS_ROUTES.privilegedFoodWarningReports,
							)}
							label="Food warning reports"
							description={describeFoodWarningQueue()}
							actionRequiredCount={foodWarningActionCount ?? 0}
							actionRequiredLabel="food warning reports and follow-ups requiring review"
						>
							{#snippet icon()}<WarningTriangle />{/snippet}
						</ProfilePrivilegedToolLink>
					{/if}
					{#if canReviewProducts && hasActions(summary.pendingCatalogReviewItems)}
						<ProfilePrivilegedToolLink
							href={getProfileSettingsRouteHref(
								PROFILE_SETTINGS_ROUTES.privilegedCatalogReviewWork,
							)}
							label="Catalog review work"
							description={describeQueue(summary.pendingCatalogReviewItems)}
							actionRequiredCount={summary.pendingCatalogReviewItems ?? 0}
							actionRequiredLabel="catalog decisions requiring review"
						>
							{#snippet icon()}<Sliders />{/snippet}
						</ProfilePrivilegedToolLink>
					{/if}
					{#if canReviewProducts && hasActions(summary.pendingProductSubmissions)}
						<ProfilePrivilegedToolLink
							href={getProfileSettingsRouteHref(
								PROFILE_SETTINGS_ROUTES.privilegedProductSubmissions,
							)}
							label="Product submissions"
							description={describeQueue(summary.pendingProductSubmissions)}
							actionRequiredCount={summary.pendingProductSubmissions ?? 0}
							actionRequiredLabel="product submissions requiring review"
						>
							{#snippet icon()}<BrandCup />{/snippet}
						</ProfilePrivilegedToolLink>
					{/if}
					{#if canManageAccounts && hasActions(summary.pendingProfileImageReviews)}
						<ProfilePrivilegedToolLink
							href={getProfileSettingsRouteHref(
								PROFILE_SETTINGS_ROUTES.privilegedProfileImages,
							)}
							label="Profile images"
							description={describeQueue(summary.pendingProfileImageReviews)}
							actionRequiredCount={summary.pendingProfileImageReviews ?? 0}
							actionRequiredLabel="profile images requiring review"
						>
							{#snippet icon()}<User />{/snippet}
						</ProfilePrivilegedToolLink>
					{/if}
					{#if canReadDataOperations && hasActions(summary.pendingCatalogDataOperations)}
						<ProfilePrivilegedToolLink
							href={getProfileSettingsRouteHref(
								PROFILE_SETTINGS_ROUTES.privilegedDataOperations,
							)}
							label="Catalog data operations"
							description={describeQueue(summary.pendingCatalogDataOperations)}
							actionRequiredCount={summary.pendingCatalogDataOperations ?? 0}
							actionRequiredLabel="catalog subjects requiring data operations"
						>
							{#snippet icon()}<Sliders />{/snippet}
						</ProfilePrivilegedToolLink>
					{/if}
				</div>
			</section>
		{/if}

		<section
			class="profile-privileged-tools-dashboard__section"
			aria-labelledby="privileged-tools-workspaces-title"
		>
			<header>
				<h2 id="privileged-tools-workspaces-title">
					{hasActionableWork ? "Other workspaces" : "Workspaces"}
				</h2>
				<p>Each workspace contains one kind of decision or operational task.</p>
			</header>
			<div class="profile-privileged-tools-dashboard__link-grid">
				{#if canReviewProducts && !hasActions(summary.pendingProductSubmissions)}
					<ProfilePrivilegedToolLink
						href={getProfileSettingsRouteHref(
							PROFILE_SETTINGS_ROUTES.privilegedProductSubmissions,
						)}
						label="Product submissions"
						description={describeQueue(summary.pendingProductSubmissions)}
					>
						{#snippet icon()}<BrandCup />{/snippet}
					</ProfilePrivilegedToolLink>
				{/if}
				{#if canReviewProducts && !hasActions(summary.pendingCatalogReviewItems)}
					<ProfilePrivilegedToolLink
						href={getProfileSettingsRouteHref(
							PROFILE_SETTINGS_ROUTES.privilegedCatalogReviewWork,
						)}
						label="Catalog review work"
						description={describeQueue(summary.pendingCatalogReviewItems)}
					>
						{#snippet icon()}<Sliders />{/snippet}
					</ProfilePrivilegedToolLink>
				{/if}
				{#if canReviewWarnings && !hasActions(foodWarningActionCount)}
					<ProfilePrivilegedToolLink
						href={getProfileSettingsRouteHref(
							PROFILE_SETTINGS_ROUTES.privilegedFoodWarningReports,
						)}
						label="Food warning reports"
						description={describeFoodWarningQueue()}
					>
						{#snippet icon()}<WarningTriangle />{/snippet}
					</ProfilePrivilegedToolLink>
				{/if}
				{#if canManageAccounts && !hasActions(summary.pendingProfileImageReviews)}
					<ProfilePrivilegedToolLink
						href={getProfileSettingsRouteHref(
							PROFILE_SETTINGS_ROUTES.privilegedProfileImages,
						)}
						label="Profile images"
						description={describeQueue(summary.pendingProfileImageReviews)}
					>
						{#snippet icon()}<User />{/snippet}
					</ProfilePrivilegedToolLink>
				{/if}
				{#if canManageAccounts}
					<ProfilePrivilegedToolLink
						href={getProfileSettingsRouteHref(
							PROFILE_SETTINGS_ROUTES.privilegedAccountAccess,
						)}
						label="Account access"
						description="Find an account and review or change its access"
					>
						{#snippet icon()}<ShieldCheck />{/snippet}
					</ProfilePrivilegedToolLink>
				{/if}
				{#if canReadDataOperations && !hasActions(summary.pendingCatalogDataOperations)}
					<ProfilePrivilegedToolLink
						href={getProfileSettingsRouteHref(
							PROFILE_SETTINGS_ROUTES.privilegedDataOperations,
						)}
						label="Catalog data operations"
						description={describeQueue(summary.pendingCatalogDataOperations)}
					>
						{#snippet icon()}<Sliders />{/snippet}
					</ProfilePrivilegedToolLink>
				{/if}
			</div>
		</section>

		{#if canReadDataOperations}
			<section
				class="profile-privileged-tools-dashboard__section profile-privileged-tools-dashboard__diagnostics"
				aria-labelledby="privileged-tools-diagnostics-title"
			>
				<header>
					<h2 id="privileged-tools-diagnostics-title">System diagnostics</h2>
					<p>
						Catalog reach, blendCalcAPI publication, monitoring, sources,
						datasets, and policy health. These are signals, not extra work
						items.
					</p>
				</header>
				{#if diagnostics}
					<CatalogDataOperationsDashboard
						dashboard={diagnostics.dashboard}
						catalogMonitor={diagnostics.catalogMonitor}
					/>
				{:else if diagnosticsUnavailable}
					<StatusMessage
						tone="warning"
						title="Diagnostics temporarily unavailable"
						message="The workspaces remain available, but system health could not be loaded. Refresh before treating the dashboard as current."
					/>
				{/if}
			</section>
		{/if}
	</div>
</div>

<style lang="scss">
	@use "./ProfilePrivilegedToolsDashboard.scss";
</style>
