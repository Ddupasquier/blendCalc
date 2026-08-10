<script lang="ts">
	import SheetBase from "$lib/components/common/sheets/SheetBase/SheetBase.svelte";
	import type { RightSheetProps } from "./types";

	let {
		open = false,
		labelledby,
		onClose = () => {},
		children,
	}: RightSheetProps = $props();
</script>

<SheetBase
	{open}
	placement="right"
	{labelledby}
	modal={false}
	backdrop={false}
	{onClose}
>
	<div class="right-sheet__content">
		{@render children()}
	</div>
</SheetBase>

<style lang="scss">
	@use "./RightSheet.scss";
</style>
