<script lang="ts">
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import DisclosureChevron from "$lib/components/common/disclosure/DisclosureChevron/DisclosureChevron.svelte";
	import { animatedDetails } from "$lib/utils/animation/animatedDetails";
	import type { CollapsibleSectionProps } from "./types";

	let {
		title,
		titleId,
		badge,
		open = false,
		surface = "accent",
		tone = "neutral",
		class: className = "",
		onOpenChange,
		summaryEnd,
		children,
	}: CollapsibleSectionProps = $props();
</script>

<details
	class={`collapsible-section ${className}`.trim()}
	data-surface={surface}
	data-tone={tone}
	use:animatedDetails={{ open, onOpenChange }}
	{open}
>
	<summary>
		<span class="collapsible-section__heading">
			<DisclosureChevron class="collapsible-section__chevron" />
			<span id={titleId} class="collapsible-section__title">
				{title}
				{#if tone === "danger"}
					<span class="collapsible-section__attention">Urgent attention needed.</span>
				{:else if tone === "warning"}
					<span class="collapsible-section__attention">Attention needed.</span>
				{/if}
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
