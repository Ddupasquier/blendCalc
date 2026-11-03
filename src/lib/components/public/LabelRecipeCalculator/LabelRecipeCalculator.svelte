<script lang="ts">
	import TwoStepConfirmation from "$lib/components/common/actions/TwoStepConfirmation/TwoStepConfirmation.svelte";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import NumberInput from "$lib/components/common/forms/NumberInput/NumberInput.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import { animatedDetails } from "$lib/utils/animation/animatedDetails";
	import {
		calculateLabelRecipe,
		createLabelIngredient,
		DEMO_NUTRIENTS,
		MAX_LABEL_INGREDIENTS,
	} from "$lib/utils/demo/publicDemo";
	import { formatNutritionAmount } from "$lib/utils/food/nutrients/nutritionDisplay";

	let ingredients = $state([createLabelIngredient(1)]);
	let nextId = 2;
	let servings = $state("1");
	let notice = $state("");
	const recipe = $derived(calculateLabelRecipe(ingredients, servings));
	const display = (value: number | null) =>
		value === null ? "Incomplete" : formatNutritionAmount(value);
	const addIngredient = () => {
		if (ingredients.length >= MAX_LABEL_INGREDIENTS) return;
		ingredients.push(createLabelIngredient(nextId++));
		notice = `Ingredient ${ingredients.length} added.`;
	};
</script>

<section
	class="label-calculator"
	id="your-recipe"
	aria-labelledby="label-calculator-title"
>
	<div class="label-calculator__intro">
		<p class="eyebrow">Have the packages handy?</p>
		<h2 id="label-calculator-title">Calculate your own recipe.</h2>
		<p>
			Copy the numbers from each label, enter how much you used, and split the
			batch into portions. No account needed.
		</p>
		<p class="field-help">
			Nothing you enter here is uploaded or saved. Keep a copy before leaving or
			reloading this page. Blank nutrients stay incomplete; enter 0 only when
			the label reports zero.
		</p>
	</div>
	<div class="label-calculator__workspace">
		<div class="label-calculator__ingredients">
			{#each ingredients as ingredient, index (ingredient.id)}
				<fieldset class="label-calculator__ingredient">
					<legend>Ingredient {index + 1}</legend>
					<TextField
						id={`label-name-${ingredient.id}`}
						label="Ingredient name"
						placeholder="e.g. Rolled oats"
						maxlength={80}
						value={ingredient.name}
						oninput={(event) => (ingredient.name = event.currentTarget.value)}
					/>
					<div class="label-calculator__fields">
						<div>
							<label for={`label-used-${ingredient.id}`}>Amount used (g)</label>
							<NumberInput
								id={`label-used-${ingredient.id}`}
								value={ingredient.grams}
								min={0}
								max={100000}
								placeholder="e.g. 80"
								onValueChange={(value) => (ingredient.grams = value)}
							/>
						</div>
						<div>
							<label for={`label-basis-${ingredient.id}`}
								>Label serving weight (g)</label
							>
							<NumberInput
								id={`label-basis-${ingredient.id}`}
								value={ingredient.labelGrams}
								min={0}
								max={100000}
								placeholder="e.g. 40, or 100 for per 100 g"
								onValueChange={(value) => (ingredient.labelGrams = value)}
							/>
						</div>
					</div>
					<p class="field-help">
						Use the gram weight printed beside the label’s serving size. Cups
						and milliliters need a product-specific gram weight; they are not
						interchangeable.
					</p>
					<details open use:animatedDetails>
						<summary>Nutrition for that label serving</summary>
						<div class="label-calculator__fields">
							{#each DEMO_NUTRIENTS as nutrient (nutrient.key)}
								<div>
									<label for={`label-${nutrient.key}-${ingredient.id}`}
										>{nutrient.label} ({nutrient.unit})</label
									>
									<NumberInput
										id={`label-${nutrient.key}-${ingredient.id}`}
										value={ingredient.nutrients[nutrient.key]}
										min={0}
										max={100000}
										placeholder="Value on label, or leave blank"
										onValueChange={(value) =>
											(ingredient.nutrients[nutrient.key] = value)}
									/>
								</div>
							{/each}
						</div>
					</details>
					{#if ingredients.length > 1}
						<TwoStepConfirmation
							actionLabel={`Remove ingredient ${index + 1}`}
							confirmationLabel={`Confirm remove ingredient ${index + 1}`}
							message="Tap or click again to remove this ingredient."
							messageId={`remove-label-${ingredient.id}`}
							onConfirm={() => {
								ingredients = ingredients.filter(
									(item) => item.id !== ingredient.id,
								);
								notice = `Ingredient ${index + 1} removed.`;
							}}
						>
							{#snippet children(control)}
								<ActionButton
									variant="ghost"
									size="small"
									ariaLabel={control.label}
									onclick={control.activate}
								>
									{control.armed ? "Confirm remove" : "Remove ingredient"}
								</ActionButton>
							{/snippet}
						</TwoStepConfirmation>
					{/if}
				</fieldset>
			{/each}
			<ActionButton
				variant="secondary"
				disabled={ingredients.length >= MAX_LABEL_INGREDIENTS}
				onclick={addIngredient}>Add ingredient</ActionButton
			>
			<p role="status" class="field-help">
				{notice ||
					`Up to ${MAX_LABEL_INGREDIENTS} ingredients. Use 0 grams to leave one out.`}
			</p>
		</div>
		<section
			class="label-calculator__results"
			aria-labelledby="label-results-title"
		>
			<h3 id="label-results-title">Your recipe totals</h3>
			<label for="label-servings">Number of equal portions</label>
			<NumberInput
				id="label-servings"
				value={servings}
				min={1}
				max={1000}
				step={1}
				placeholder="e.g. 4"
				onValueChange={(value) => (servings = value)}
			/>
			{#if recipe}
				<p>
					{formatNutritionAmount(recipe.grams)} g in the batch · {recipe.servings}
					{recipe.servings === 1 ? "portion" : "portions"}
				</p>
				<table>
					<caption>Nutrition from your entries</caption>
					<thead
						><tr
							><th scope="col">Nutrient</th><th scope="col">Batch</th><th
								scope="col">Per portion</th
							></tr
						></thead
					>
					<tbody>
						{#each DEMO_NUTRIENTS as nutrient (nutrient.key)}
							<tr
								><th scope="row">{nutrient.label} ({nutrient.unit})</th><td
									>{display(recipe.totals[nutrient.key])}</td
								><td>{display(recipe.perServing[nutrient.key])}</td></tr
							>
						{/each}
					</tbody>
				</table>
			{:else}
				<p>
					Enter the amount used and a positive label serving weight for each
					ingredient, plus 1–1000 whole portions. Use nonnegative numbers up to
					100,000; nutrient fields can stay blank.
				</p>
			{/if}
			<p class="field-help">
				These are calculations from your entries, not independently verified
				nutrition. “Incomplete” means at least one included ingredient is
				missing that nutrient; it does not mean zero.
			</p>
			<p class="field-help">
				The batch weight is the sum of ingredient weights before cooking. Water
				gained or lost during cooking changes weight, so these results do not
				estimate nutrients per 100 g of the cooked dish.
			</p>
		</section>
	</div>
</section>

<style lang="scss">
	@use "./LabelRecipeCalculator.scss";
</style>
