<script lang="ts">
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import {
		getFoodCompatibilityEvaluationMessage,
	} from "$lib/utils/food/quality/foodCompatibilityEvaluationMessages";
	import {
		getUniqueFoodMetadataTags,
	} from "$lib/utils/food/records/foodMetadataPresentation";
	import type { ProductCompatibilityPanelProps } from "./types";

	let { food }: ProductCompatibilityPanelProps = $props();

	const allergenDisplay = $derived(food.allergenDisclosure);
	const precautionaryStatements = $derived(
		(food.precautionaryStatements ?? []).filter((statement) => statement.text.trim()),
	);
	const dietaryLabels = $derived(
		getUniqueFoodMetadataTags(
			(food.compatibilitySummary?.dietaryClaims ?? [])
				.map((fact) => fact.label),
		),
	);
	const dietaryConsiderations = $derived(
		getUniqueFoodMetadataTags(
			(food.compatibilitySummary?.allFacts ?? [])
				.filter((fact) =>
					fact.category === "avoidance" &&
					fact.factType === "dietary_conflict"
				)
				.map((fact) => fact.label),
		),
	);
	const evaluationMessage = $derived(
		food.compatibilityEvaluation
			? getFoodCompatibilityEvaluationMessage(food.compatibilityEvaluation)
			: null,
	);
	const hasContent = $derived(
		Boolean(
			evaluationMessage ||
				allergenDisplay?.contains.length ||
					allergenDisplay?.mayContain.length ||
					precautionaryStatements.length ||
				dietaryLabels.length ||
				dietaryConsiderations.length,
		),
	);
</script>

{#if hasContent}
	<div class="product-compatibility-panel">
		{#if evaluationMessage}
			<StatusMessage
				tone={evaluationMessage.tone}
				title={evaluationMessage.title}
				message={evaluationMessage.message}
			/>
		{/if}

		{#if allergenDisplay?.contains.length}
			<section class="product-compatibility-panel__group">
				<h2>Contains</h2>
				<p>{allergenDisplay.contains.join(", ")}</p>
			</section>
		{/if}

		{#if precautionaryStatements.length}
			{#each precautionaryStatements as statement (`${statement.type}:${statement.text}`)}
				<section class="product-compatibility-panel__group">
					<h2>{statement.type === "shared_equipment"
						? "Shared equipment"
						: statement.type === "shared_facility"
							? "Shared facility"
							: statement.type === "may_contain"
								? "May contain"
								: "Package advisory"}</h2>
					<p>{statement.text}</p>
				</section>
			{/each}
		{:else if allergenDisplay?.mayContain.length}
			<section class="product-compatibility-panel__group">
				<h2>May contain</h2>
				<p>{allergenDisplay.mayContain.join(", ")}</p>
			</section>
		{/if}

		{#if dietaryLabels.length}
			<section class="product-compatibility-panel__group">
				<h2>Dietary labels</h2>
				<p>{dietaryLabels.join(", ")}</p>
			</section>
		{/if}

		{#if dietaryConsiderations.length}
			<section class="product-compatibility-panel__group">
				<h2>Dietary considerations</h2>
				<p>{dietaryConsiderations.join(", ")}</p>
			</section>
		{/if}
	</div>
{/if}

<style lang="scss">
	@use "./ProductCompatibilityPanel.scss";
</style>
