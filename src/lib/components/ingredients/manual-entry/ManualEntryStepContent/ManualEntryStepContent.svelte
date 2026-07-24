<script lang="ts">
	import type { ManualEntryStepContentProps } from "./types";
	import IdentityStep from "$lib/components/ingredients/manual-entry/steps/IdentityStep/IdentityStep.svelte";
	import NutrientStep from "$lib/components/ingredients/manual-entry/steps/NutrientStep/NutrientStep.svelte";
	import ServingsStep from "$lib/components/ingredients/manual-entry/steps/ServingsStep/ServingsStep.svelte";
	import ShareStep from "$lib/components/ingredients/manual-entry/steps/ShareStep/ShareStep.svelte";

	let {
		activeStep,
		identity,
		servings,
		macros,
		extended,
		share,
	}: ManualEntryStepContentProps = $props();
</script>

{#if activeStep === "identity"}
	<IdentityStep {...identity} />
{:else if activeStep === "servings"}
	<ServingsStep {...servings} />
{:else if activeStep === "macros"}
	<NutrientStep {...macros} />
{:else if activeStep === "extended"}
	<NutrientStep {...extended} />
{:else}
	<ShareStep {...share} />
{/if}
