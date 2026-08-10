<script lang="ts">
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import {
		getFoodCompatibilityEvaluationMessage,
	} from "$lib/utils/food/quality/foodCompatibilityEvaluationMessages";
	import {
		getUniqueFoodMetadataTags,
	} from "$lib/utils/food/records/foodMetadataPresentation";
	import type { ProductCompatibilityPanelProps } from "./types";

	let { food, mode = "all" }: ProductCompatibilityPanelProps = $props();
	const showSummary = $derived(mode !== "details");
	const showDetails = $derived(mode !== "summary");

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
	const regulatoryContext = $derived(
		food.compatibilityEvaluation?.regulatoryContext ?? null,
	);
	const unresolvedPreferences = $derived(
		food.compatibilityEvaluation?.preferenceResolution?.unresolvedPreferences ?? [],
	);
	const showEvaluationMessage = $derived(Boolean(
		evaluationMessage &&
		(
			food.compatibilityEvaluation?.status !== "conflict" ||
			(food.preferenceWarnings ?? []).length === 0
		),
	));
	const hasCheckDetails = $derived(Boolean(
		unresolvedPreferences.length ||
		regulatoryContext?.status === "applied" ||
		regulatoryContext?.status === "unsupported",
	));
	const hasSummaryContent = $derived(
		Boolean(
			showEvaluationMessage ||
				allergenDisplay?.contains.length ||
					allergenDisplay?.mayContain.length ||
					precautionaryStatements.length ||
				dietaryLabels.length ||
				dietaryConsiderations.length,
		),
	);
</script>

{#if showSummary && hasSummaryContent}
	<div class="product-compatibility-panel">
		{#if evaluationMessage && showEvaluationMessage}
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

{#if showDetails && hasCheckDetails}
	<div class="product-compatibility-panel">
		<CollapsibleSection title="Food check details" surface="panel">
			<div class="product-compatibility-panel__check-details">
					{#if unresolvedPreferences.length}
						<StatusMessage
							tone="warning"
							title="Some settings are waiting for review"
							message={`${unresolvedPreferences.map((item) => item.label).join(", ")} ${unresolvedPreferences.length === 1 ? "is" : "are"} saved, but not included in automated checks until there is one exact reviewed match.`}
						/>
					{/if}

					{#if regulatoryContext?.status === "applied" && regulatoryContext.profile}
						<section class="product-compatibility-panel__group">
							<h2>Regional label context</h2>
							<p>
								Uses {regulatoryContext.profile.displayName} guidance from
								{regulatoryContext.profile.authority}. Regulated allergens are expected
								to use the listed label terms, while all of your personal warnings stay active.
							</p>
							{#if regulatoryContext.coveredPreferences.length}
								<p>
									Covered settings:
									{regulatoryContext.coveredPreferences.map((item) =>
										`${item.preference} (${item.regulatedLabel})`,
									).join(", ")}.
								</p>
							{/if}
							{#if regulatoryContext.uncoveredPreferences.length}
								<p>
									Not defined by this regional profile:
									{regulatoryContext.uncoveredPreferences.join(", ")}. Personal checks
									still continue.
								</p>
							{/if}
							<a
								href={regulatoryContext.profile.sourceUrl}
								target="_blank"
								rel="noreferrer"
							>
								View official labeling guidance
							</a>
						</section>
					{:else if regulatoryContext?.status === "unsupported"}
						<section class="product-compatibility-panel__group">
							<h2>Regional label context unavailable</h2>
							<p>
								Your personal warnings still apply, but no regional label profile was
								checked for {regulatoryContext.requestedRegionCode}.
							</p>
						</section>
					{/if}
			</div>
		</CollapsibleSection>
	</div>
{/if}

<style lang="scss">
	@use "./ProductCompatibilityPanel.scss";
</style>
