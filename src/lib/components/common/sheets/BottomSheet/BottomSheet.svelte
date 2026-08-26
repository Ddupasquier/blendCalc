<script lang="ts">
	import SheetBase from "$lib/components/common/sheets/SheetBase/SheetBase.svelte";
	import type { BottomSheetProps } from "./types";

	let {
		id,
		open,
		title,
		titleId = "bottom-sheet-title",
		label = title,
		aboveNav = true,
		fill = false,
		comfortable = false,
		returnFocusTarget,
		titleAccessory,
		children,
		onClose,
	}: BottomSheetProps = $props();
</script>

<SheetBase
	{id}
	{open}
	placement="bottom"
	label={title ? undefined : label}
	labelledby={title ? titleId : undefined}
	{aboveNav}
	{fill}
	{comfortable}
	{returnFocusTarget}
	{onClose}
>
	<div class="bottom-sheet">
		<div class="bottom-sheet__chrome">
			<button
				class="bottom-sheet__handle"
				type="button"
				aria-label="Close sheet"
				onclick={onClose}
			>
				<span aria-hidden="true"></span>
			</button>
			<div class="bottom-sheet__header">
				{#if title}
					<h2 id={titleId}>{title}</h2>
				{/if}
				{#if titleAccessory}
					<div class="bottom-sheet__title-accessory">
						{@render titleAccessory()}
					</div>
				{/if}
			</div>
		</div>
		<div class="bottom-sheet__content">
			{@render children()}
		</div>
	</div>
</SheetBase>

<style lang="scss">
	@use "./BottomSheet.scss";
</style>
