<script lang="ts">
	import ActionLink from "$lib/components/common/buttons/ActionLink/ActionLink.svelte";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import NumberInput from "$lib/components/common/forms/NumberInput/NumberInput.svelte";
	import PublicPageShell from "$lib/components/public/PublicPageShell/PublicPageShell.svelte";
	import {
		calculateDemoMix,
		createDemoAmounts,
		DEMO_FOODS,
		DEMO_NUTRIENTS,
		parseDemoGrams,
	} from "$lib/utils/demo/publicDemo";
	import { formatNutritionAmount } from "$lib/utils/food/nutrients/nutritionDisplay";
	let amounts = $state(createDemoAmounts());
	let notice = $state("");
	const mix = $derived(calculateDemoMix(amounts));
	const loadExample = () => {
		amounts = createDemoAmounts();
		notice = "Breakfast bowl loaded. Your demo changes have been reset.";
	};
</script>

<PublicPageShell next="/mix">
	<section class="demo-intro" aria-labelledby="demo-title">
		<p class="eyebrow">A little taste of blendCalc</p>
		<h1 id="demo-title">Try a Mix. No account needed.</h1>
		<p>
			Start with our example breakfast bowl. Change the amounts, explore the
			sample nutrition, and see how each ingredient contributes.
		</p>
		<p class="sample-notice" id="sample-notice">
			Sample data only: these are illustrative nutrition values, not actual
			product labels. Your changes stay on this page and reset when you reload.
			No account, food lookup, recall check, or saved recipe is created.
		</p>
	</section>
	<div class="demo-workspace">
		<section class="demo-ingredients" aria-labelledby="demo-ingredients-title">
			<p class="eyebrow">Ingredients</p>
			<h2 id="demo-ingredients-title">What goes into your bowl?</h2>
			<p>Amounts are in grams. Set an ingredient to 0 to leave it out.</p>
			{#each DEMO_FOODS as food (food.id)}
				<article class="demo-food">
					<div class="demo-food__heading">
						<div>
							<p class="category">{food.category} · Example food</p>
							<h3>{food.name}</h3>
						</div>
						<span class="sample-badge">Sample</span>
					</div>
					<p>{food.description}</p>
					<label for={`demo-${food.id}`}>{food.name} amount (g)</label>
					<NumberInput
						id={`demo-${food.id}`}
						value={amounts[food.id]}
						min={0}
						max={1000}
						step={1}
						placeholder="0–1000 g"
						ariaDescribedBy={`demo-${food.id}-help`}
						onValueChange={(value) => {
							amounts[food.id] = value;
							notice = "";
						}}
					/>
					<p class="field-help" id={`demo-${food.id}-help`}>
						{parseDemoGrams(amounts[food.id]) === null
							? "Enter a whole number from 0 to 1000 grams."
							: "Whole grams, from 0 to 1000."}
					</p>
					<details>
						<summary>Sample nutrition per 100 g</summary>
						<dl>
							{#each DEMO_NUTRIENTS as nutrient}<div>
									<dt>{nutrient.label}</dt>
									<dd>{food.nutrients[nutrient.key]} {nutrient.unit}</dd>
								</div>{/each}
						</dl>
						<p class="field-help">{food.note}</p>
					</details>
				</article>
			{/each}
		</section>
		<div class="demo-results">
			<section class="demo-panel" aria-labelledby="demo-total-title">
				<p class="eyebrow">Mix</p>
				<h2 id="demo-total-title">Your bowl, together.</h2>
				<p>
					Each sample value scales from 100 g to the amount you enter. The total
					adds those contributions together.
				</p>
				{#if mix}
					<p class="mix-weight">{mix.grams} <span>grams in your Mix</span></p>
					<dl aria-label="Sample Mix nutrition">
						{#each DEMO_NUTRIENTS as nutrient}<div>
								<dt>{nutrient.label}</dt>
								<dd>
									{formatNutritionAmount(mix.nutrients[nutrient.key])}
									{nutrient.unit}
								</dd>
							</div>{/each}
					</dl>
					{#if mix.grams === 0}<p>
							Your Mix is empty. Add an amount above to start again.
						</p>{/if}
				{:else}<p class="sample-notice">
						Check the ingredient amounts to see a valid total. No estimate is
						substituted for an invalid amount.
					</p>{/if}
				<p role="status" class="field-help">
					{notice ||
						(mix
							? `Mix updated: ${mix.grams} grams, ${formatNutritionAmount(mix.nutrients.energy)} kcal from sample data.`
							: "Totals paused. Enter valid whole-gram amounts.")}
				</p>
			</section>
			<section class="demo-panel" aria-labelledby="demo-recipe-title">
				<p class="eyebrow">Saved recipe example</p>
				<h2 id="demo-recipe-title">Breakfast bowl</h2>
				<p>
					100 g rolled oats, 150 g plain yogurt, and 75 g berries. Reload the
					example whenever you want a fresh start.
				</p>
				<ActionButton variant="secondary" onclick={loadExample}
					>Load example recipe</ActionButton
				>
			</section>
			<section class="demo-panel" aria-labelledby="demo-next-title">
				<h2 id="demo-next-title">Make your own.</h2>
				<p>
					Sign in to find foods, organize your Fridge and Shopping List, and
					save your own Mixes and favorites. Demo changes do not transfer to
					your account.
				</p>
				<ActionLink href="/auth?next=%2Fmix"
					>Sign in to build and save</ActionLink
				>
				<p class="field-help">
					Available nutrition and warning evidence can be incomplete. This demo
					does not provide dietary advice or certify that a food is safe.
				</p>
			</section>
		</div>
	</div>
</PublicPageShell>

<style lang="scss">
	@use "./page.scss";
</style>
