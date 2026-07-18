<script lang="ts">
	import WarningTriangle from "$lib/assets/icons/WarningTriangle.svelte";
	import StatusIconBadge from "$lib/components/common/badges/StatusIconBadge.svelte";
	import type {
		NutrientFoodSuggestion,
		NutrientReductionSuggestion,
	} from "$lib/utils/mix/calculations";

	type Adjustment =
		| {
				type: "add";
				suggestion: NutrientFoodSuggestion;
		  }
		| {
				type: "reduce";
				suggestion: NutrientReductionSuggestion;
		  };

	let {
		foodSuggestions = [],
		reductionSuggestions = [],
		onAdd,
		onReduce,
		maxSuggestions = 3,
	}: {
		foodSuggestions?: NutrientFoodSuggestion[];
		reductionSuggestions?: NutrientReductionSuggestion[];
		onAdd: (foodId: number, servingGrams: number) => void;
		onReduce: (foodId: number, nextServingGrams: number) => void;
		maxSuggestions?: number;
	} = $props();

	let isOpen = $state(false);

	const formatAmount = (value: number) => {
		if (value >= 100) return value.toFixed(0);
		if (value >= 10) return value.toFixed(1);
		return value.toFixed(2).replace(/\.?0+$/, "");
	};

	const formatGrams = (value: number) => {
		if (value >= 100) return value.toFixed(0);
		if (value >= 10) return value.toFixed(1);
		return value.toFixed(1).replace(/\.0$/, "");
	};

	const getConflictCount = (adjustment: Adjustment) =>
		adjustment.suggestion.conflicts.length;

	const getAdjustmentPriority = (adjustment: Adjustment) => {
		if (getConflictCount(adjustment) > 0) return 2;
		return adjustment.type === "reduce" ? 0 : 1;
	};

	const adjustments = $derived(
		[
			...reductionSuggestions.map((suggestion) => ({
				type: "reduce" as const,
				suggestion,
			})),
			...foodSuggestions.map((suggestion) => ({
				type: "add" as const,
				suggestion,
			})),
		]
			.sort((a, b) => {
				const priorityDifference =
					getAdjustmentPriority(a) - getAdjustmentPriority(b);
				if (priorityDifference !== 0) return priorityDifference;
				return getConflictCount(a) - getConflictCount(b);
			})
			.slice(0, maxSuggestions),
	);

	const getActionLabel = (adjustment: Adjustment) => {
		if (adjustment.type === "reduce") return "Use less";
		return adjustment.suggestion.action === "increase" ? "Add more" : "Add";
	};

	const getImpactLabel = (adjustment: Adjustment) => {
		if (adjustment.type === "reduce") {
			return `Lower ${adjustment.suggestion.nutrientLabel}`;
		}

		return `Reach ${adjustment.suggestion.nutrientLabel}`;
	};

	const getPrimaryText = (adjustment: Adjustment) => {
		if (adjustment.type === "reduce") {
			return `Use ${formatGrams(adjustment.suggestion.reduceByGrams)}g less to lower ${adjustment.suggestion.nutrientLabel}.`;
		}

		const verb = adjustment.suggestion.action === "increase" ? "Add" : "Use";
		return `${verb} ${formatGrams(adjustment.suggestion.servingGramsToTarget)}g ${adjustment.suggestion.action === "increase" ? "more" : ""} to reach ${adjustment.suggestion.nutrientLabel}.`;
	};

	const getAmountText = (adjustment: Adjustment) => {
		if (adjustment.type === "reduce") {
			if (adjustment.suggestion.nextServingGrams < 1) {
				return "New amount: remove it";
			}
			return `New amount: ${formatGrams(adjustment.suggestion.nextServingGrams)}g`;
		}

		if (adjustment.suggestion.action === "increase") {
			return `New amount: ${formatGrams(adjustment.suggestion.nextServingGrams)}g`;
		}

		return `Amount to use: ${formatGrams(adjustment.suggestion.nextServingGrams)}g`;
	};

	const getHelpText = (adjustment: Adjustment) => {
		if (adjustment.type === "reduce") {
			return `Lowers ${adjustment.suggestion.nutrientLabel} by ${formatAmount(adjustment.suggestion.targetReducedAmount)}${adjustment.suggestion.unit}.`;
		}

		return `Adds ${formatAmount(adjustment.suggestion.targetAddedAmount)}${adjustment.suggestion.unit} ${adjustment.suggestion.nutrientLabel}.`;
	};

	const getWarningText = (adjustment: Adjustment) => {
		const conflict = adjustment.suggestion.conflicts[0];
		if (!conflict) return "";

		if (adjustment.type === "reduce") {
			return conflict.reason === "already-under"
				? `This may make ${conflict.label} even lower.`
				: `This may drop ${conflict.label} below goal.`;
		}

		return conflict.reason === "already-over"
			? `You are already over ${conflict.label}.`
			: `This may push ${conflict.label} over goal.`;
	};

	const applyAdjustment = (adjustment: Adjustment) => {
		if (adjustment.type === "reduce") {
			onReduce(adjustment.suggestion.food.fdcId, adjustment.suggestion.nextServingGrams);
			return;
		}

		onAdd(adjustment.suggestion.food.fdcId, adjustment.suggestion.nextServingGrams);
	};
</script>

{#if adjustments.length > 0}
	<section
		class="nutrient-adjustments"
		aria-label="Suggested ingredient adjustments"
	>
		<button
			type="button"
			class="nutrient-adjustments__header"
			aria-expanded={isOpen}
			onclick={() => (isOpen = !isOpen)}
		>
			<StatusIconBadge
				class="nutrient-adjustments__alert"
				label="Suggested adjustments available"
				decorative
			>
				<WarningTriangle size="1em" />
			</StatusIconBadge>
			<span class="nutrient-adjustments__copy">
				<span class="nutrient-adjustments__title">Suggested Adjustments</span>
				<span class="nutrient-adjustments__summary">
					{adjustments.length}
					{adjustments.length === 1 ? "change" : "changes"} can help this smoothie.
				</span>
			</span>
			<span class:open={isOpen} class="nutrient-adjustments__chevron" aria-hidden="true">
				⌄
			</span>
		</button>

		{#if isOpen}
			<div class="nutrient-adjustments__list">
				{#each adjustments as adjustment}
					<article
						class:has-warning={adjustment.suggestion.conflicts.length > 0}
						class="nutrient-adjustment"
					>
						<div class="nutrient-adjustment__main">
							<div class="nutrient-adjustment__title-row">
								<div>
									<span class="nutrient-adjustment__source">
										{adjustment.suggestion.sourceLabel}
									</span>
									<strong>{adjustment.suggestion.food.description}</strong>
								</div>
								<span class:type-reduce={adjustment.type === "reduce"} class="nutrient-adjustment__impact">
									{getImpactLabel(adjustment)}
								</span>
							</div>

							<p class="nutrient-adjustment__action">
								<strong>{getActionLabel(adjustment)}:</strong>
								{getPrimaryText(adjustment)}
							</p>
							<p class="nutrient-adjustment__amount">
								{getAmountText(adjustment)}
							</p>
							<p class="nutrient-adjustment__help">
								{getHelpText(adjustment)}
							</p>

							{#if adjustment.suggestion.conflicts.length > 0}
								<p class="nutrient-adjustment__warning">
									<span>Watch out:</span>
									{getWarningText(adjustment)}
								</p>
							{/if}
						</div>

						<button type="button" onclick={() => applyAdjustment(adjustment)}>
							Apply
						</button>
					</article>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.nutrient-adjustments {
		width: 100%;
		margin-top: $app-gap-sm;
		padding: 0.45rem;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-card-radius;
	}

	.nutrient-adjustments__header {
		width: 100%;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.55rem;
		align-items: center;
		padding: 0.42rem;
		color: inherit;
		background: transparent;
		border-radius: $app-radius;
		text-align: left;

		&:hover {
			background: $app-section-bg;
		}
	}

	:global(.nutrient-adjustments__alert) {
		--circular-icon-frame-color: #{$app-highlight-text};
		--circular-icon-frame-background: #{$app-highlight};
	}

	.nutrient-adjustments__copy {
		display: grid;
		gap: 0.08rem;
		min-width: 0;
	}

	.nutrient-adjustments__title {
		color: $app-primary;
		font-size: 0.92rem;
		font-weight: 800;
	}

	.nutrient-adjustments__summary {
		color: $app-muted;
		font-size: 0.76rem;
		font-weight: 700;
		line-height: 1.3;
	}

	.nutrient-adjustments__chevron {
		color: $app-primary;
		font-size: 1.15rem;
		font-weight: 900;
		line-height: 1;
		transition: transform 0.16s ease;

		&.open {
			transform: rotate(180deg);
		}
	}

	.nutrient-adjustments__list {
		display: grid;
		gap: 0.42rem;
		margin-top: 0.45rem;
	}

	.nutrient-adjustment {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.55rem;
		align-items: end;
		padding: 0.6rem;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-radius;

		&.has-warning {
			border-color: $app-warning-border-color;
		}
	}

	.nutrient-adjustment__main {
		display: grid;
		gap: 0.16rem;
		min-width: 0;
	}

	.nutrient-adjustment__title-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.4rem;
		align-items: start;
		min-width: 0;
	}

	.nutrient-adjustment__title-row > div {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}

	.nutrient-adjustment__source,
	.nutrient-adjustment__impact {
		width: fit-content;
		max-width: 100%;
		padding: 0.12rem 0.42rem;
		color: $app-primary;
		background: $app-accent;
		border-radius: $app-radius-pill;
		font-size: 0.66rem;
		font-weight: 800;
		line-height: 1.2;
	}

	.nutrient-adjustment__impact {
		background: $app-success-bg;

		&.type-reduce {
			background: $app-warning-bg;
		}
	}

	strong {
		color: $app-primary;
		font-size: 0.78rem;
		font-weight: 800;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	p {
		color: $app-muted;
		font-size: 0.72rem;
		font-weight: 700;
		line-height: 1.28;
	}

	.nutrient-adjustment__action strong {
		font-size: inherit;
		white-space: normal;
	}

	.nutrient-adjustment__amount {
		color: $app-primary;
	}

	.nutrient-adjustment__help {
		font-size: 0.68rem;
	}

	.nutrient-adjustment__warning {
		margin-top: 0.18rem;
		padding: 0.34rem 0.42rem;
		color: $app-primary;
		background: $app-warning-bg;
		border-radius: $app-radius-sm;

		span {
			font-weight: 900;
		}
	}

	.nutrient-adjustment > button {
		justify-self: end;
		padding: 0.34rem 0.62rem;
		color: $app-btn-text;
		background: $app-btn-bg;
		border-radius: $app-radius-pill;
		font-size: 0.74rem;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;

		&:hover {
			background: $app-btn-bg-hover;
		}
	}

	@media (max-width: $app-breakpoint-sm) {
		.nutrient-adjustment {
			grid-template-columns: 1fr;
		}

		.nutrient-adjustment__title-row {
			grid-template-columns: 1fr;
		}

		.nutrient-adjustment > button {
			justify-self: stretch;
		}
	}
</style>
