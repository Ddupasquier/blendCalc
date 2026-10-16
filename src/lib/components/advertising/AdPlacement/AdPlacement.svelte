<script lang="ts">
	import CloseButton from "$lib/components/common/buttons/CloseButton/CloseButton.svelte";
	import type { AdPlacementProps } from "./types";

	let { format = "inline", children, ondismiss }: AdPlacementProps = $props();
</script>

<aside
	class="ad-placement"
	class:ad-placement--break={format === "break"}
	aria-label="Advertisement"
>
	<div class="ad-placement__heading">
		<span class="ad-placement__label">Advertisement</span>
		{#if format === "break" && ondismiss}
			<CloseButton
				label="Dismiss advertisement"
				size="small"
				onclick={ondismiss}
			/>
		{/if}
	</div>
	<div class="ad-placement__content">{@render children()}</div>
</aside>

<style lang="scss">
	@use "./AdPlacement.scss";
</style>
