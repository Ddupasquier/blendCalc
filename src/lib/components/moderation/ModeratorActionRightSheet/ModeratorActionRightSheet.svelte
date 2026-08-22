<script lang="ts">
	import BackButton from "$lib/components/common/buttons/BackButton/BackButton.svelte";
	import PrivilegedActionBadge from "$lib/components/common/badges/PrivilegedActionBadge/PrivilegedActionBadge.svelte";
	import RightSheet from "$lib/components/common/sheets/RightSheet/RightSheet.svelte";
	import ViewBody from "$lib/components/common/view/ViewBody/ViewBody.svelte";
	import ViewFrame from "$lib/components/common/view/ViewFrame/ViewFrame.svelte";
	import ViewHeader from "$lib/components/common/view/ViewHeader/ViewHeader.svelte";
	import ViewTop from "$lib/components/common/view/ViewTop/ViewTop.svelte";
	import type { ModeratorActionRightSheetProps } from "./types";

	let {
		id,
		title,
		subtitle,
		onClose,
		children,
	}: ModeratorActionRightSheetProps = $props();

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
					<PrivilegedActionBadge label={`${title} moderator tool`} />
				</div>
			</div>
		</ViewTop>
		<ViewBody className="moderator-action-right-sheet__body" scroll>
			{@render children()}
		</ViewBody>
	</ViewFrame>
</RightSheet>

<style lang="scss">
	@use "./ModeratorActionRightSheet.scss";
</style>
