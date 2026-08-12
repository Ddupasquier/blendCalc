<script lang="ts">
	import BrandCup from "$lib/assets/icons/BrandCup/BrandCup.svelte";
	import ShieldCheck from "$lib/assets/icons/ShieldCheck/ShieldCheck.svelte";
	import Sliders from "$lib/assets/icons/Sliders/Sliders.svelte";
	import User from "$lib/assets/icons/User/User.svelte";
	import WarningTriangle from "$lib/assets/icons/WarningTriangle/WarningTriangle.svelte";
	import PrivilegedActionGroup from "$lib/components/common/actions/PrivilegedActionGroup/PrivilegedActionGroup.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import BottomSheet from "$lib/components/common/sheets/BottomSheet/BottomSheet.svelte";
	import BottomSheetAction from "$lib/components/common/sheets/BottomSheetAction/BottomSheetAction.svelte";
	import type { ProfileModeratorActionSheetProps } from "./types";

	let {
		open,
		summary,
		onClose,
		onNavigate,
	}: ProfileModeratorActionSheetProps = $props();

	const describeQueue = (count: number | null) => {
		if (count === null) return "Review count is temporarily unavailable";
		if (count === 0) return "Nothing is waiting for review";
		return count === 1 ? "1 item is waiting for review" : `${count} items are waiting for review`;
	};

	const openModeratorDestination = (href: string) => {
		onClose();
		onNavigate(href);
	};
</script>

<BottomSheet
	id="profile-moderator-actions-sheet"
	{open}
	title="Moderator actions"
	titleId="profile-moderator-actions-sheet-title"
	onClose={onClose}
>
	<div class="profile-moderator-action-sheet">
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

		<PrivilegedActionGroup title="Moderator actions">
			<BottomSheetAction
				label="Product submissions"
				description={describeQueue(summary.pendingProductSubmissions)}
				disabled={!summary.pendingProductSubmissions}
				actionRequiredCount={summary.pendingProductSubmissions ?? 0}
				actionRequiredLabel="product submissions requiring review"
				onSelect={() => openModeratorDestination("/moderation#product-review")}
			>
				{#snippet icon()}<BrandCup />{/snippet}
			</BottomSheetAction>
			<BottomSheetAction
				label="Food warning reports"
				description={describeQueue(summary.pendingFoodWarningReports)}
				disabled={!summary.pendingFoodWarningReports}
				actionRequiredCount={summary.pendingFoodWarningReports ?? 0}
				actionRequiredLabel="food warning reports requiring review"
				onSelect={() => openModeratorDestination("/moderation#compatibility-review")}
			>
				{#snippet icon()}<WarningTriangle />{/snippet}
			</BottomSheetAction>
			<BottomSheetAction
				label="Profile images"
				description={describeQueue(summary.pendingProfileImageReviews)}
				disabled={!summary.pendingProfileImageReviews}
				actionRequiredCount={summary.pendingProfileImageReviews ?? 0}
				actionRequiredLabel="profile images requiring review"
				onSelect={() => openModeratorDestination("/moderation?q=pending#account-review")}
			>
				{#snippet icon()}<User />{/snippet}
			</BottomSheetAction>
			<BottomSheetAction
				label="Account access"
				description="Search accounts, block access, or restore access"
				onSelect={() => openModeratorDestination("/moderation#account-review")}
			>
				{#snippet icon()}<ShieldCheck />{/snippet}
			</BottomSheetAction>
			<BottomSheetAction
				label="Catalog data health"
				description="Review source, mapping, policy, and API readiness"
				onSelect={() => openModeratorDestination("/moderation/data-health")}
			>
				{#snippet icon()}<Sliders />{/snippet}
			</BottomSheetAction>
		</PrivilegedActionGroup>
	</div>
</BottomSheet>

<style lang="scss">
	@use "./ProfileModeratorActionSheet.scss";
</style>
