<script lang="ts">
	import Popover from "$lib/components/common/display/Popover/Popover.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import MixPanelSection from "$lib/components/mix/layout/MixPanelSection/MixPanelSection.svelte";
	import type { MixWarningsProps } from "./types";

	let {
		warnings = [],
		openWarningId = null,
		onOpenWarning,
		onCloseWarning,
		open = false,
		onOpenChange,
		attentionTone,
	}: MixWarningsProps = $props();

	const resolvedAttentionTone = $derived(
		attentionTone ??
			(warnings.some((warning) => warning.severity === "danger")
				? "danger"
				: "warning"),
	);
</script>

{#if warnings.length > 0}
	<MixPanelSection
		class="mix-warnings"
		attentionTone={resolvedAttentionTone}
		ariaLabel="Warnings"
		title="Warnings"
		badge={String(warnings.length)}
		{open}
		{onOpenChange}
	>
		<span class="sr-only" role="status" aria-live="polite" aria-atomic="true">
			{resolvedAttentionTone === "danger"
				? `${warnings.length} urgent ${warnings.length === 1 ? "warning" : "warnings"}.`
				: `${warnings.length} ${warnings.length === 1 ? "warning" : "warnings"}.`}
		</span>
		<div class="mix-warnings__list">
			{#each warnings as warning}
				<article
					class={`mix-warning mix-warning--${warning.severity}`}
					data-warning-id={warning.id}
				>
					<CircularIconFrame class="mix-warning__symbol" decorative>
						{warning.symbol}
					</CircularIconFrame>
					<div class="mix-warning__body">
						<strong>{warning.title}</strong>
						<p>{warning.message}</p>
					</div>
					{#if warning.details?.length}
						<Popover
							open={openWarningId === warning.id}
							buttonLabel="Why?"
							title={warning.title}
							onOpen={() => onOpenWarning(warning.id)}
							onClose={onCloseWarning}
						>
							{#if warning.detailSummary}
								<p class="mix-warning__popover-summary">
									{warning.detailSummary}
								</p>
							{/if}
							<ul class="mix-warning__details">
								{#each warning.details as detail}
									<li>
										<strong>{detail.label}</strong>
										<span>{detail.value}</span>
									</li>
								{/each}
							</ul>
						</Popover>
					{/if}
				</article>
			{/each}
		</div>
	</MixPanelSection>
{/if}

<style lang="scss">
	@use "./MixWarnings.scss";
</style>
