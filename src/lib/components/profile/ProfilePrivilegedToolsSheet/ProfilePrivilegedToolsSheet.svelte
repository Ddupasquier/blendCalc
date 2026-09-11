<script lang="ts">
	import BrandCup from "$lib/assets/icons/BrandCup/BrandCup.svelte";
	import ShieldCheck from "$lib/assets/icons/ShieldCheck/ShieldCheck.svelte";
	import Sliders from "$lib/assets/icons/Sliders/Sliders.svelte";
	import User from "$lib/assets/icons/User/User.svelte";
	import WarningTriangle from "$lib/assets/icons/WarningTriangle/WarningTriangle.svelte";
	import PrivilegedActionGroup from "$lib/components/common/actions/PrivilegedActionGroup/PrivilegedActionGroup.svelte";
	import PrivilegedActionBadge from "$lib/components/common/badges/PrivilegedActionBadge/PrivilegedActionBadge.svelte";
	import ActionRequiredCountBadge from "$lib/components/common/badges/ActionRequiredCountBadge/ActionRequiredCountBadge.svelte";
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import BottomSheet from "$lib/components/common/sheets/BottomSheet/BottomSheet.svelte";
	import BottomSheetAction from "$lib/components/common/sheets/BottomSheetAction/BottomSheetAction.svelte";
	import {
		getProfileSettingsRouteHref,
		PROFILE_SETTINGS_ROUTES,
	} from "$lib/utils/profile/profileRouteState";
	import {
		getProfilePrivilegedToolTitle,
		hasAppPermission,
		PROFILE_PRIVILEGED_TOOL_PERMISSIONS,
	} from "$lib/utils/moderation/profilePrivilegedTools";
	import type { ProfilePrivilegedToolsSheetProps } from "./types";

	let { open, access, onClose, onNavigate }: ProfilePrivilegedToolsSheetProps =
		$props();
	const title = $derived(getProfilePrivilegedToolTitle(access.role));
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
	const hasActions = (count: number | null) =>
		typeof count === "number" && count > 0;
	const foodWarningActionCount = $derived(
		summary.pendingFoodWarningReports === null ||
			summary.pendingFoodWarningFollowUps === null
			? null
			: summary.pendingFoodWarningReports + summary.pendingFoodWarningFollowUps,
	);
	const hasActionableWork = $derived(
		!summary.identityVerificationRequired &&
			!summary.unavailable &&
			(summary.totalActionableItems ?? 0) > 0,
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
		summary.identityVerificationRequired
			? "Verify once to see today's work"
			: summary.unavailable
				? "Queue status is temporarily unavailable"
				: hasActionableWork
					? `${summary.totalActionableItems} ${summary.totalActionableItems === 1 ? "action needs" : "actions need"} attention`
					: "You're all caught up",
	);
	const overviewDescription = $derived(
		summary.identityVerificationRequired
			? "Open any protected tool and complete authenticator verification. Counts will appear without exposing review work first."
			: summary.unavailable
				? "You can still use standing lookup and diagnostic tools. Queue-only tools stay unavailable until counts can be read safely."
				: hasActionableWork
					? `Start with ${firstPriorityLabel}. Red badges always mean a human decision or repair is waiting.`
					: "No human decisions are waiting. Standing lookup and diagnostic tools remain available below.",
	);

	const describeQueue = (count: number | null) => {
		if (summary.identityVerificationRequired) {
			return "Verify your identity to check this queue";
		}
		if (count === null) return "Review count is temporarily unavailable";
		if (count === 0) return "Nothing is waiting for review";
		return count === 1
			? "1 item is waiting for review"
			: `${count} items are waiting for review`;
	};
	const describeFoodWarningQueue = () => {
		if (summary.identityVerificationRequired) {
			return "Verify your identity to check this queue";
		}
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

	const isQueueActionDisabled = (count: number | null) =>
		!summary.identityVerificationRequired && (count === null || count === 0);

	const openPrivilegedToolDestination = (href: string) => {
		onClose();
		onNavigate(href);
	};
</script>

{#snippet productSubmissionsAction()}
	<BottomSheetAction
		label="Product submissions"
		description={describeQueue(summary.pendingProductSubmissions)}
		disabled={isQueueActionDisabled(summary.pendingProductSubmissions)}
		actionRequiredCount={summary.pendingProductSubmissions ?? 0}
		actionRequiredLabel="product submissions requiring review"
		onSelect={() =>
			openPrivilegedToolDestination(
				getProfileSettingsRouteHref(
					PROFILE_SETTINGS_ROUTES.privilegedProductSubmissions,
				),
			)}
	>
		{#snippet icon()}<BrandCup />{/snippet}
	</BottomSheetAction>
{/snippet}

{#snippet catalogReviewAction()}
	<BottomSheetAction
		label="Catalog review work"
		description={describeQueue(summary.pendingCatalogReviewItems)}
		actionRequiredCount={summary.pendingCatalogReviewItems ?? 0}
		actionRequiredLabel="catalog decisions requiring review"
		onSelect={() =>
			openPrivilegedToolDestination(
				getProfileSettingsRouteHref(
					PROFILE_SETTINGS_ROUTES.privilegedCatalogReviewWork,
				),
			)}
	>
		{#snippet icon()}<Sliders />{/snippet}
	</BottomSheetAction>
{/snippet}

{#snippet warningReportsAction()}
	<BottomSheetAction
		label="Food warning reports"
		description={describeFoodWarningQueue()}
		disabled={isQueueActionDisabled(foodWarningActionCount)}
		actionRequiredCount={foodWarningActionCount ?? 0}
		actionRequiredLabel="food warning reports and follow-ups requiring review"
		onSelect={() =>
			openPrivilegedToolDestination(
				getProfileSettingsRouteHref(
					PROFILE_SETTINGS_ROUTES.privilegedFoodWarningReports,
				),
			)}
	>
		{#snippet icon()}<WarningTriangle />{/snippet}
	</BottomSheetAction>
{/snippet}

{#snippet profileImagesAction()}
	<BottomSheetAction
		label="Profile images"
		description={describeQueue(summary.pendingProfileImageReviews)}
		disabled={isQueueActionDisabled(summary.pendingProfileImageReviews)}
		actionRequiredCount={summary.pendingProfileImageReviews ?? 0}
		actionRequiredLabel="profile images requiring review"
		onSelect={() =>
			openPrivilegedToolDestination(
				getProfileSettingsRouteHref(
					PROFILE_SETTINGS_ROUTES.privilegedProfileImages,
				),
			)}
	>
		{#snippet icon()}<User />{/snippet}
	</BottomSheetAction>
{/snippet}

{#snippet accountAccessAction()}
	<BottomSheetAction
		label="Account access"
		description="Find an account and review or change its access"
		onSelect={() =>
			openPrivilegedToolDestination(
				getProfileSettingsRouteHref(
					PROFILE_SETTINGS_ROUTES.privilegedAccountAccess,
				),
			)}
	>
		{#snippet icon()}<ShieldCheck />{/snippet}
	</BottomSheetAction>
{/snippet}

{#snippet dataOperationsAction()}
	<BottomSheetAction
		label="Catalog data operations"
		description={describeQueue(summary.pendingCatalogDataOperations)}
		actionRequiredCount={summary.pendingCatalogDataOperations ?? 0}
		actionRequiredLabel="catalog subjects requiring data operations"
		onSelect={() =>
			openPrivilegedToolDestination(
				getProfileSettingsRouteHref(
					PROFILE_SETTINGS_ROUTES.privilegedDataOperations,
				),
			)}
	>
		{#snippet icon()}<Sliders />{/snippet}
	</BottomSheetAction>
{/snippet}

<BottomSheet
	id="profile-privileged-tools-sheet"
	{open}
	{title}
	titleId="profile-privileged-tools-sheet-title"
	{onClose}
>
	{#snippet titleAccessory()}
		<PrivilegedActionBadge label={title} />
	{/snippet}
	<div class="profile-privileged-tools-sheet">
		<section
			class="profile-privileged-tools-sheet__overview"
			data-tone={summary.identityVerificationRequired
				? "protected"
				: summary.unavailable
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
						label={summary.identityVerificationRequired
							? "Protected"
							: summary.unavailable
								? "Unknown"
								: "0 waiting"}
						tone={summary.unavailable
							? "warning"
							: summary.identityVerificationRequired
								? "info"
								: "success"}
					/>
				{/if}
			</header>
			<strong>{overviewTitle}</strong>
			<p>{overviewDescription}</p>
		</section>

		{#if hasActionableWork}
			<section
				class="profile-privileged-tools-sheet__group"
				aria-labelledby="profile-attention-title"
			>
				<h2 id="profile-attention-title">Needs attention</h2>
				<PrivilegedActionGroup
					title="Needs attention"
					showHeader={false}
					class="profile-privileged-tools-sheet__action-group--attention"
				>
					{#if canReviewWarnings && hasActions(foodWarningActionCount)}{@render warningReportsAction()}{/if}
					{#if canReviewProducts && hasActions(summary.pendingCatalogReviewItems)}{@render catalogReviewAction()}{/if}
					{#if canReviewProducts && hasActions(summary.pendingProductSubmissions)}{@render productSubmissionsAction()}{/if}
					{#if canManageAccounts && hasActions(summary.pendingProfileImageReviews)}{@render profileImagesAction()}{/if}
					{#if canReadDataOperations && hasActions(summary.pendingCatalogDataOperations)}{@render dataOperationsAction()}{/if}
				</PrivilegedActionGroup>
			</section>
		{/if}

		<section
			class="profile-privileged-tools-sheet__group"
			aria-labelledby="profile-review-work-title"
		>
			<h2 id="profile-review-work-title">
				{hasActionableWork ? "Other review tools" : "Review tools"}
			</h2>
			<PrivilegedActionGroup title="Review tools" showHeader={false}>
				{#if canReviewProducts && !hasActions(summary.pendingProductSubmissions)}{@render productSubmissionsAction()}{/if}
				{#if canReviewProducts && !hasActions(summary.pendingCatalogReviewItems)}{@render catalogReviewAction()}{/if}
				{#if canReviewWarnings && !hasActions(foodWarningActionCount)}{@render warningReportsAction()}{/if}
				{#if canManageAccounts && !hasActions(summary.pendingProfileImageReviews)}{@render profileImagesAction()}{/if}
				{#if canManageAccounts}{@render accountAccessAction()}{/if}
			</PrivilegedActionGroup>
		</section>
		{#if canReadDataOperations && !hasActions(summary.pendingCatalogDataOperations)}
			<section
				class="profile-privileged-tools-sheet__group"
				aria-labelledby="profile-data-operations-title"
			>
				<h2 id="profile-data-operations-title">System operations</h2>
				<PrivilegedActionGroup title="System operations" showHeader={false}>
					{@render dataOperationsAction()}
				</PrivilegedActionGroup>
			</section>
		{/if}
	</div>
</BottomSheet>

<style lang="scss">
	@use "./ProfilePrivilegedToolsSheet.scss";
</style>
