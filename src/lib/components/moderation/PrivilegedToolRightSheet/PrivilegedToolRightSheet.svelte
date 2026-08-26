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
	import PrivilegedToolInformationSheet from "$lib/components/moderation/PrivilegedToolInformationSheet/PrivilegedToolInformationSheet.svelte";
	import type { PrivilegedToolRightSheetProps } from "./types";

	let {
		id,
		title,
		subtitle,
		informationKey,
		onClose,
		children,
	}: PrivilegedToolRightSheetProps = $props();
	let informationOpen = $state(false);

	const titleId = $derived(`${id}-title`);
</script>

<RightSheet {id} open labelledby={titleId} {onClose}>
	<ViewFrame className="privileged-tool-right-sheet">
		<ViewTop>
			<div class="privileged-tool-right-sheet__header">
				<BackButton
					label="Back to privileged tools"
					variant="ghost"
					size="small"
					onclick={onClose}
				/>
				<div class="privileged-tool-right-sheet__heading">
					<ViewHeader {title} {subtitle} {titleId} />
					<div class="privileged-tool-right-sheet__header-actions">
						<CircleIconButton
							label={`About ${title}`}
							variant="ghost"
							size="small"
							onclick={() => (informationOpen = true)}
						>
							<Info />
						</CircleIconButton>
						<PrivilegedActionBadge label={`${title} privileged tool`} />
					</div>
				</div>
			</div>
		</ViewTop>
		<ViewBody className="privileged-tool-right-sheet__body" scroll>
			{@render children()}
		</ViewBody>
	</ViewFrame>
</RightSheet>

<PrivilegedToolInformationSheet
	open={informationOpen}
	action={informationKey}
	onClose={() => (informationOpen = false)}
/>

<style lang="scss">
	@use "./PrivilegedToolRightSheet.scss";
</style>
