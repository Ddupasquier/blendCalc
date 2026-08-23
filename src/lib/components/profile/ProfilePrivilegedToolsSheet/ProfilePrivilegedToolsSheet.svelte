<script lang="ts">
	import BrandCup from "$lib/assets/icons/BrandCup/BrandCup.svelte";
	import ShieldCheck from "$lib/assets/icons/ShieldCheck/ShieldCheck.svelte";
	import Sliders from "$lib/assets/icons/Sliders/Sliders.svelte";
	import User from "$lib/assets/icons/User/User.svelte";
	import WarningTriangle from "$lib/assets/icons/WarningTriangle/WarningTriangle.svelte";
	import PrivilegedActionGroup from "$lib/components/common/actions/PrivilegedActionGroup/PrivilegedActionGroup.svelte";
	import PrivilegedActionBadge from "$lib/components/common/badges/PrivilegedActionBadge/PrivilegedActionBadge.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
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

	let {
		open,
		access,
		onClose,
		onNavigate,
	}: ProfilePrivilegedToolsSheetProps = $props();
	const title = $derived(getProfilePrivilegedToolTitle(access.role));
	const summary = $derived(access.reviewSummary);
	const canReviewProducts = $derived(hasAppPermission(
		access.permissions,
		PROFILE_PRIVILEGED_TOOL_PERMISSIONS.catalogReview,
	));
	const canReviewWarnings = $derived(hasAppPermission(
		access.permissions,
		PROFILE_PRIVILEGED_TOOL_PERMISSIONS.warningReview,
	));
	const canManageAccounts = $derived(hasAppPermission(
		access.permissions,
		PROFILE_PRIVILEGED_TOOL_PERMISSIONS.accountManagement,
	));
	const canReadDataHealth = $derived(hasAppPermission(
		access.permissions,
		PROFILE_PRIVILEGED_TOOL_PERMISSIONS.dataHealthRead,
	));

	const describeQueue = (count: number | null) => {
		if (summary.identityVerificationRequired) {
			return "Verify your identity to check this queue";
		}
		if (count === null) return "Review count is temporarily unavailable";
		if (count === 0) return "Nothing is waiting for review";
		return count === 1 ? "1 item is waiting for review" : `${count} items are waiting for review`;
	};

	const isQueueActionDisabled = (count: number | null) =>
		summary.unavailable ||
		(!summary.identityVerificationRequired && count === 0);

	const openPrivilegedToolDestination = (href: string) => {
		onClose();
		onNavigate(href);
	};
</script>

<BottomSheet
	id="profile-privileged-tools-sheet"
	{open}
	{title}
	titleId="profile-privileged-tools-sheet-title"
	onClose={onClose}
>
	{#snippet titleAccessory()}
		<PrivilegedActionBadge label={title} />
	{/snippet}
	<div class="profile-privileged-tools-sheet">
		{#if summary.identityVerificationRequired}
			<StatusMessage
				tone="info"
				message="Verify with your authenticator when you open a protected tool. Review counts stay private until then."
			/>
		{:else if summary.unavailable}
			<StatusMessage
				tone="warning"
				message="Review counts are temporarily unavailable. Account and data-health tools still work."
			/>
		{/if}

		<PrivilegedActionGroup {title} showHeader={false}>
			{#if canReviewProducts}
			<BottomSheetAction
				label="Product submissions"
				description={describeQueue(summary.pendingProductSubmissions)}
				disabled={isQueueActionDisabled(summary.pendingProductSubmissions)}
				actionRequiredCount={summary.pendingProductSubmissions ?? 0}
				actionRequiredLabel="product submissions requiring review"
				onSelect={() => openPrivilegedToolDestination(getProfileSettingsRouteHref(PROFILE_SETTINGS_ROUTES.privilegedProductSubmissions))}
			>
				{#snippet icon()}<BrandCup />{/snippet}
			</BottomSheetAction>
			{/if}
			{#if canReviewWarnings}
			<BottomSheetAction
				label="Food warning reports"
				description={describeQueue(summary.pendingFoodWarningReports)}
				disabled={isQueueActionDisabled(summary.pendingFoodWarningReports)}
				actionRequiredCount={summary.pendingFoodWarningReports ?? 0}
				actionRequiredLabel="food warning reports requiring review"
				onSelect={() => openPrivilegedToolDestination(getProfileSettingsRouteHref(PROFILE_SETTINGS_ROUTES.privilegedFoodWarningReports))}
			>
				{#snippet icon()}<WarningTriangle />{/snippet}
			</BottomSheetAction>
			{/if}
			{#if canManageAccounts}
			<BottomSheetAction
				label="Profile images"
				description={describeQueue(summary.pendingProfileImageReviews)}
				disabled={isQueueActionDisabled(summary.pendingProfileImageReviews)}
				actionRequiredCount={summary.pendingProfileImageReviews ?? 0}
				actionRequiredLabel="profile images requiring review"
				onSelect={() => openPrivilegedToolDestination(getProfileSettingsRouteHref(PROFILE_SETTINGS_ROUTES.privilegedProfileImages))}
			>
				{#snippet icon()}<User />{/snippet}
			</BottomSheetAction>
			<BottomSheetAction
				label="Account access"
				description="Search accounts, block access, or restore access"
				onSelect={() => openPrivilegedToolDestination(getProfileSettingsRouteHref(PROFILE_SETTINGS_ROUTES.privilegedAccountAccess))}
			>
				{#snippet icon()}<ShieldCheck />{/snippet}
			</BottomSheetAction>
			{/if}
			{#if canReadDataHealth}
			<BottomSheetAction
				label="Catalog data health"
				description="Review source, mapping, policy, and API readiness"
				onSelect={() => openPrivilegedToolDestination(getProfileSettingsRouteHref(PROFILE_SETTINGS_ROUTES.privilegedCatalogDataHealth))}
			>
				{#snippet icon()}<Sliders />{/snippet}
			</BottomSheetAction>
			{/if}
		</PrivilegedActionGroup>
	</div>
</BottomSheet>

<style lang="scss">
	@use "./ProfilePrivilegedToolsSheet.scss";
</style>
