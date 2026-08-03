<script lang="ts">
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import type { ProductIngredientsPanelProps } from "./types";

	let { food, mode = "all" }: ProductIngredientsPanelProps = $props();
	const showSummary = $derived(mode !== "details");
	const showDetails = $derived(mode !== "summary");

	const presentation = $derived(food.ingredientPresentation);
	const ingredientText = $derived(
		presentation?.ingredientText ||
			food.ingredients?.trim() ||
			(food.ingredientList ?? [])
				.map((ingredient) => ingredient.trim())
				.filter(Boolean)
				.join(", "),
	);
	const hasDetails = $derived(Boolean(
		presentation &&
		(
			presentation.rows.length > 0 ||
			presentation.additives.length > 0 ||
			presentation.metrics.length > 0 ||
			presentation.tagGroups.length > 0
			),
	));
</script>

{#if showSummary && ingredientText}
	<section class="product-ingredients-panel" aria-labelledby="product-ingredients-title">
		<h2 id="product-ingredients-title">Ingredients</h2>
		<p>{ingredientText}</p>
	</section>
{/if}

{#if showDetails && hasDetails && presentation}
	<div class="product-ingredients-panel">
		<CollapsibleSection title="Ingredient details" surface="panel">
			<div class="product-ingredients-panel__content">
					{#if presentation.rows.length > 0}
						<div class="product-ingredients-panel__details">
							<h3>Ingredient breakdown</h3>
							<ul>
								{#each presentation.rows as ingredient}
									<li class={`product-ingredients-panel__depth-${ingredient.depth}`}>
										<div>
											<span>{ingredient.text}</span>
											{#if ingredient.classifications.length > 0}
												<small>
													Source analysis:
													{ingredient.classifications.map((item) =>
														`${item.label} — ${item.value}`,
													).join(" · ")}
												</small>
											{/if}
										</div>
										{#if ingredient.percentageLabel}
											<strong>{ingredient.percentageLabel}</strong>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if presentation.metrics.length > 0}
						<div class="product-ingredients-panel__details">
							<h3>Analysis coverage</h3>
							<dl>
								{#each presentation.metrics as metric}
									<div>
										<dt>{metric.label}</dt>
										<dd>{metric.value}</dd>
									</div>
								{/each}
							</dl>
						</div>
					{/if}

					{#each presentation.tagGroups as group}
						<div class="product-ingredients-panel__details">
							<h3>{group.label}</h3>
							<p>{group.values.join(", ")}</p>
						</div>
					{/each}

					{#if presentation.additives.length > 0}
						<div class="product-ingredients-panel__details">
							<h3>Additives</h3>
							<p>{presentation.additives.join(", ")}</p>
						</div>
					{/if}

					{#if presentation.hasSourceAnalysis}
						<p class="product-ingredients-panel__note">
							Source analysis adds context but does not replace the current package
							label or blendCalc food warnings.
						</p>
					{/if}
			</div>
		</CollapsibleSection>
	</div>
{/if}

<style lang="scss">
	@use "./ProductIngredientsPanel.scss";
</style>
