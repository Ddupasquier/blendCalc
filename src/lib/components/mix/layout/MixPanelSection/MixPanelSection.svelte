<script lang="ts">
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import type { MixPanelSectionProps } from "./types";

	let {
		title,
		titleId,
		badge,
		open = false,
		attentionTone = "neutral",
		class: className = "",
		ariaLabel,
		tutorialReveal,
		onOpenChange,
		summaryEnd,
		children,
	}: MixPanelSectionProps = $props();
</script>

<section
	class={`mix-panel-section ${className}`.trim()}
	data-attention-tone={attentionTone}
	aria-label={ariaLabel}
>
	<CollapsibleSection
		{title}
		{titleId}
		{badge}
		{open}
		{tutorialReveal}
		{onOpenChange}
		{summaryEnd}
		surface="panel"
	>
		{@render children()}
	</CollapsibleSection>
</section>

<style lang="scss">
	@use "./MixPanelSection.scss";
</style>
