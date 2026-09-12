<script lang="ts">
	import SheetBase from "$lib/components/common/sheets/SheetBase/SheetBase.svelte";
	import type { RightSheetProps } from "./types";

	let {
		id,
		open = false,
		labelledby,
		className = "",
		panelClass = "",
		onClose = () => {},
		children,
	}: RightSheetProps = $props();
</script>

<SheetBase
	{id}
	{open}
	placement="right"
	{labelledby}
	modal={false}
	backdrop={false}
	{className}
	{panelClass}
	{onClose}
>
	<div class="right-sheet__content">
		{@render children()}
	</div>
</SheetBase>

<style lang="scss">
	@use "./RightSheet.scss";
</style>
