<script lang="ts">
	import CloseButton from "$lib/components/common/buttons/CloseButton/CloseButton.svelte";
	import type { PopoverProps } from "./types";

	let {
		open,
		buttonLabel = "Details",
		title = "",
		children,
		onOpen,
		onClose,
	}: PopoverProps = $props();
</script>

<div class="popover">
	<button
		class="popover__trigger"
		type="button"
		aria-expanded={open}
		onclick={() => (open ? onClose() : onOpen())}
	>
		{buttonLabel}
	</button>

	{#if open}
		<div class="popover__panel" role="dialog" aria-label={title || buttonLabel}>
			<CloseButton
				class="popover__close"
				size="small"
				label={`Close ${title || buttonLabel}`}
				onclick={onClose}
			/>
			{#if title}
				<h5>{title}</h5>
			{/if}
			{#if children}
				{@render children()}
			{/if}
		</div>
	{/if}
</div>

<style lang="scss">
	@use "./Popover.scss";
</style>
