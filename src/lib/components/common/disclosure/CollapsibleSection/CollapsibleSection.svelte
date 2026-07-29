<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import { animatedDetails } from "$lib/utils/accessibility/animatedDetails";
	import type { CollapsibleSectionProps } from "./types";

	let {
		title,
		titleId,
		badge,
		open = false,
		surface = "accent",
		class: className = "",
		summaryEnd,
		children,
	}: CollapsibleSectionProps = $props();
</script>

<details
	class={`collapsible-section ${className}`.trim()}
	data-surface={surface}
	use:animatedDetails
	{open}
>
	<summary>
		<span class="collapsible-section__heading">
			<span class="collapsible-section__chevron" aria-hidden="true">
				<Chevron direction="down" />
			</span>
			<span id={titleId} class="collapsible-section__title">
				{title}
				{#if badge}
					<TextBadge label={badge} tone="neutral" />
				{/if}
			</span>
		</span>
		{#if summaryEnd}
			<span class="collapsible-section__actions">
				{@render summaryEnd()}
			</span>
		{/if}
	</summary>
	<div class="collapsible-section__content">
		{@render children()}
	</div>
</details>

<style lang="scss">
	@use "./CollapsibleSection.scss";
</style>
