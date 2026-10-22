<script lang="ts">
	import { resolve } from "$app/paths";
	import ActionLink from "$lib/components/common/buttons/ActionLink/ActionLink.svelte";
	import BreakfastBowlIllustration from "$lib/components/public/BreakfastBowlIllustration/BreakfastBowlIllustration.svelte";
	import PublicPageShell from "$lib/components/public/PublicPageShell/PublicPageShell.svelte";
	import {
		calculateDemoMix,
		createDemoAmounts,
	} from "$lib/utils/demo/publicDemo";
	import { formatNutritionAmount } from "$lib/utils/food/nutrients/nutritionDisplay";
	import type { LandingPageProps } from "./types";
	let { data }: LandingPageProps = $props();
	const example = calculateDemoMix(createDemoAmounts())!;
</script>

<PublicPageShell next={data.next} variant="landing">
	<section class="landing-hero" aria-labelledby="landing-title">
		<div class="landing-copy">
			<h1 id="landing-title">Keep your <span>good recipes.</span></h1>
			<p class="landing-intro">
				Find ingredients, put a mix together, and save it for next time.
				blendCalc handles the nutrition math.
			</p>
			<div class="landing-actions">
				<ActionLink href="/demo">Try the demo</ActionLink><a
					class="account-link"
					href={`${resolve("/auth")}?next=${encodeURIComponent(data.next)}`}
					>Sign in or join</a
				>
			</div>
			<p class="fine-print">Try it without creating an account.</p>
		</div>
		<figure class="sample-recipe" aria-label="Example breakfast bowl">
			<div class="sample-recipe__art"><BreakfastBowlIllustration /></div>
			<figcaption>
				<div class="recipe-title">
					<div>
						<p class="fine-print">From the demo</p>
						<h2>Breakfast bowl</h2>
						<p>Oats, yogurt &amp; berries</p>
					</div>
					<span class="recipe-weight">{example.grams} g</span>
				</div>
				<dl class="recipe-facts">
					<div>
						<dt>Energy</dt>
						<dd>
							{formatNutritionAmount(example.nutrients.energy)}
							<span>kcal</span>
						</dd>
					</div>
					<div>
						<dt>Protein</dt>
						<dd>
							{formatNutritionAmount(example.nutrients.protein)} <span>g</span>
						</dd>
					</div>
					<div>
						<dt>Fiber</dt>
						<dd>
							{formatNutritionAmount(example.nutrients.fiber)} <span>g</span>
						</dd>
					</div>
				</dl>
				<div class="recipe-link">
					<p class="fine-print">Illustrative sample values</p>
					<a href={resolve("/demo")}
						>Open sample recipe <span aria-hidden="true">→</span></a
					>
				</div>
			</figcaption>
		</figure>
	</section>

	<section class="landing-features" aria-labelledby="features-title">
		<div class="features-intro">
			<p class="eyebrow">What’s in blendCalc</p>
			<h2 id="features-title">A few useful tools for your kitchen.</h2>
		</div>
		<dl>
			<div>
				<dt>Ingredients</dt>
				<dd>
					Search for foods, scan a barcode, or add one yourself. Keep track of
					what’s in your Fridge and what’s on your Shopping List.
				</dd>
			</div>
			<div>
				<dt>Mix</dt>
				<dd>
					Add ingredients and adjust their amounts to see the combined
					nutrition. Change a portion and the totals change with it.
				</dd>
			</div>
			<div>
				<dt>Saved</dt>
				<dd>
					Save a Mix as a recipe, mark your favorites, and open it again when
					you want to make it.
				</dd>
			</div>
		</dl>
	</section>

	<aside class="landing-information" aria-label="Food information and privacy">
		<p>
			Nutrition, allergen, recall, and food-preference information can be
			incomplete. Missing data or an absence of warnings does not mean a food is
			safe. Check the package and current recall notices. blendCalc doesn’t
			provide medical or dietary advice.
		</p>
		<p>
			The demo uses temporary examples. Sign in to save your own work.
			Promotional email is optional; manage it in Profile. <a
				href={resolve("/privacy")}>Privacy &amp; advertising choices</a
			>
		</p>
	</aside>

	<div class="landing-maker">
		<section class="landing-support" aria-labelledby="support-title">
			<h2 id="support-title">Support a small, independent project.</h2>
			<p>
				If you find blendCalc useful, you can help keep it going. Donations are
				optional and don’t purchase ad-free access.
			</p>
			<a href="https://buymeacoffee.com/dylandupasquier"
				>Support on Buy Me a Coffee <span aria-hidden="true">↗</span></a
			>
		</section>
		<section class="landing-projects" aria-labelledby="projects-title">
			<h2 id="projects-title">More from ModernCraft</h2>
			<p>
				We make blendCalc—and tools that help other developers ship better
				software.
			</p>
			<dl>
				<div>
					<dt>
						<a href="https://ddupasquier.github.io/rehearsal-db/"
							>Rehearsal <span aria-hidden="true">↗</span></a
						>
					</dt>
					<dd>
						Catch database problems before your users do. Test changes against
						realistic data in a disposable local environment before you deploy.
					</dd>
				</div>
				<div>
					<dt>
						<a href="https://ddupasquier.github.io/rehearsal-db/vscode/"
							>Rehearsal for VS Code <span aria-hidden="true">↗</span></a
						>
					</dt>
					<dd>
						The same workflow, right in your editor. Review migrations, run
						checks, and see what needs attention without juggling terminal
						commands.
					</dd>
				</div>
			</dl>
		</section>
	</div>
</PublicPageShell>

<style lang="scss">
	@use "./page.scss";
</style>
