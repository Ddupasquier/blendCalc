<script lang="ts">
	import SheetBase from "$lib/components/common/sheets/SheetBase.svelte";
	import type { Snippet } from "svelte";

	let {
		open = false,
		labelledby,
		onClose = () => {},
		children,
	}: {
		open?: boolean;
		labelledby: string;
		onClose?: () => void;
		children: Snippet;
	} = $props();
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
	.right-sheet__content {
		width: 100%;
		height: 100%;
		min-height: 0;
		box-sizing: border-box;
	}
</style>
