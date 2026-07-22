<script lang="ts">
	import BackButton from "$lib/components/common/buttons/BackButton.svelte";
	import SheetBase from "$lib/components/common/sheets/SheetBase/SheetBase.svelte";
	import type { BottomSheetProps } from "$lib/components/common/sheets/types";

	let {
		open,
		title,
		titleId = "bottom-sheet-title",
		label = title,
		backLabel = "Back",
		showBack = true,
		aboveNav = true,
		fill = false,
		comfortable = false,
		children,
		onClose,
	}: BottomSheetProps = $props();

</script>

<SheetBase
	{open}
	placement="bottom"
	label={title ? undefined : label}
	labelledby={title ? titleId : undefined}
	{aboveNav}
	{fill}
	{comfortable}
	{onClose}
>
	<div
		class="bottom-sheet"
	>
		<div class="bottom-sheet__chrome">
			<button class="bottom-sheet__handle" type="button" aria-label="Close sheet" onclick={onClose}>
				<span aria-hidden="true"></span>
			</button>
			<div
				class="bottom-sheet__header"
				class:bottom-sheet__header--without-back={!showBack}
			>
				{#if showBack}
					<BackButton class="bottom-sheet__back" label={backLabel} onclick={onClose} />
				{/if}
				{#if title}
					<h2 id={titleId}>{title}</h2>
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
