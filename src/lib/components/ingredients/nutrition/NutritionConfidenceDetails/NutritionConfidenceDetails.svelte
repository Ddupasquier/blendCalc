<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
	import WarningTriangle from "$lib/assets/icons/WarningTriangle/WarningTriangle.svelte";
	import StatusIconBadge from "$lib/components/common/badges/StatusIconBadge/StatusIconBadge.svelte";
	import type { NutritionConfidenceDetailsProps } from "./types";

	let {
		quality,
		compact = false,
	}: NutritionConfidenceDetailsProps = $props();

	let isOpen = $state(false);

	const noteworthyDetails = $derived(
		quality.details.filter(
			(detail) =>
				detail.source === "missing" ||
				detail.source === "derived" ||
				detail.source === "fallback",
		),
	);

	const totalRequiredCount = $derived(quality.completeCount + quality.missingCount);

</script>

{#if quality.needsDetails && noteworthyDetails.length > 0}
	<section
		class="confidence-details {compact ? 'confidence-details--compact' : ''}"
		aria-label="Nutrition confidence details"
	>
		<button
			type="button"
			class="confidence-details__toggle"
			aria-expanded={isOpen}
			onclick={() => (isOpen = !isOpen)}
		>
			<StatusIconBadge
				label="Incomplete nutrition data"
				tone="error"
				decorative
			>
				<WarningTriangle size={12} strokeWidth={2.6} />
			</StatusIconBadge>
			<span class="confidence-details__header">
				<strong>{quality.label} nutrition data</strong>
				<span>
					{quality.completeCount}/{totalRequiredCount} required nutrients available
				</span>
			</span>
			<span
				class="confidence-details__chevron"
				class:confidence-details__chevron--open={isOpen}
				aria-hidden="true"
			>
				<Chevron direction="down" />
			</span>
		</button>

		{#if isOpen}
			<ul>
				{#each noteworthyDetails as detail}
					<li class={`confidence-detail confidence-detail--${detail.source}`}>
						<span>{detail.label}</span>
						<strong>{detail.sourceLabel}</strong>
						<small>{detail.detail}</small>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<style lang="scss">
	@use "./NutritionConfidenceDetails.scss";
</style>
