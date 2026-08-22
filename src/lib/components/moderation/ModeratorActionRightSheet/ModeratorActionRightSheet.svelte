<script lang="ts">
	import BackButton from "$lib/components/common/buttons/BackButton/BackButton.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import PrivilegedActionBadge from "$lib/components/common/badges/PrivilegedActionBadge/PrivilegedActionBadge.svelte";
	import Info from "$lib/assets/icons/Info/Info.svelte";
	import RightSheet from "$lib/components/common/sheets/RightSheet/RightSheet.svelte";
	import ViewBody from "$lib/components/common/view/ViewBody/ViewBody.svelte";
	import ViewFrame from "$lib/components/common/view/ViewFrame/ViewFrame.svelte";
	import ViewHeader from "$lib/components/common/view/ViewHeader/ViewHeader.svelte";
	import ViewTop from "$lib/components/common/view/ViewTop/ViewTop.svelte";
	import ModeratorActionInformationSheet from "$lib/components/moderation/ModeratorActionInformationSheet/ModeratorActionInformationSheet.svelte";
	import type { ModeratorActionRightSheetProps } from "./types";

	let {
		id,
		title,
		subtitle,
		informationKey,
		onClose,
		children,
	}: ModeratorActionRightSheetProps = $props();
	let informationOpen = $state(false);

	const titleId = $derived(`${id}-title`);
</script>

<RightSheet {id} open labelledby={titleId} onClose={onClose}>
	<ViewFrame className="moderator-action-right-sheet">
		<ViewTop>
			<div class="moderator-action-right-sheet__header">
				<BackButton
					label="Back to moderator actions"
					variant="ghost"
					size="small"
					onclick={onClose}
				/>
				<div class="moderator-action-right-sheet__heading">
					<ViewHeader {title} {subtitle} titleId={titleId} />
					<div class="moderator-action-right-sheet__header-actions">
						<CircleIconButton
							label={`About ${title}`}
							variant="ghost"
							size="small"
							onclick={() => informationOpen = true}
						>
							<Info />
						</CircleIconButton>
						<PrivilegedActionBadge label={`${title} moderator tool`} />
					</div>
				</div>
			</div>
		</ViewTop>
		<ViewBody className="moderator-action-right-sheet__body" scroll>
			{@render children()}
		</ViewBody>
	</ViewFrame>
</RightSheet>

<ModeratorActionInformationSheet
	open={informationOpen}
	action={informationKey}
	onClose={() => informationOpen = false}
/>

<style lang="scss">
	@use "./ModeratorActionRightSheet.scss";
</style>
