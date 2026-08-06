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
		dataTutorialTarget,
		onOpenChange,
		summaryEnd,
		children,
	}: MixPanelSectionProps = $props();
</script>

<section
	class={`mix-panel-section ${className}`.trim()}
	data-attention-tone={attentionTone}
	data-tutorial-target={dataTutorialTarget}
	aria-label={ariaLabel}
>
	<CollapsibleSection
		{title}
		{titleId}
		{badge}
		{open}
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
