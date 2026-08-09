<script lang="ts">
	import Trash from "$lib/assets/icons/Trash/Trash.svelte";
	import TwoStepConfirmation from "$lib/components/common/actions/TwoStepConfirmation/TwoStepConfirmation.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import MetadataPill from "$lib/components/common/display/MetadataPill/MetadataPill.svelte";
	import {
		getSavedRecipeCalories,
		getSavedRecipeGoalProgress,
		getSavedRecipeOverallGoalScore,
	} from "$lib/utils/recipes/savedRecipePresentation";
	import SavedRecipeExportAction from "../SavedRecipeExportAction/SavedRecipeExportAction.svelte";
	import SavedRecipeGoalPills from "../SavedRecipeGoalPills/SavedRecipeGoalPills.svelte";
	import SavedRecipeIngredientPills from "../SavedRecipeIngredientPills/SavedRecipeIngredientPills.svelte";
	import type { SavedRecipeCardProps } from "./types";

	let {
		recipe,
		loading = false,
		deleting = false,
		disabled = false,
		onLoad,
		onDelete,
	}: SavedRecipeCardProps = $props();

	const titleId = $derived(`saved-recipe-${recipe.id}-title`);
	const calories = $derived(getSavedRecipeCalories(recipe));
	const goalProgress = $derived(getSavedRecipeGoalProgress(recipe));
	const overallGoalScore = $derived(getSavedRecipeOverallGoalScore(recipe));
	const savedDate = $derived(
		new Intl.DateTimeFormat(undefined, {
			month: "short",
			day: "numeric",
			year: "numeric",
		}).format(new Date(recipe.createdAt)),
	);
	const ingredientCountLabel = $derived(
		`${recipe.foods.length} ${recipe.foods.length === 1 ? "ingredient" : "ingredients"}`,
	);
</script>

<article class="saved-recipe-card" aria-labelledby={titleId}>
	<CollapsibleSection
		title={recipe.name}
		{titleId}
		surface="panel"
		class="saved-recipe-card__collapse"
	>
		{#snippet summaryEnd()}
			{#if calories !== null}
				<MetadataPill
					class="saved-recipe-card__calories"
					label={`${calories} kcal`}
					tone="success"
				/>
			{/if}
			{#if overallGoalScore}
				<MetadataPill
					class="saved-recipe-card__goal-score"
					label={`${overallGoalScore.percent}%`}
					ariaLabel={`Overall goal match ${overallGoalScore.percent}% across ${overallGoalScore.goalCount} ${overallGoalScore.goalCount === 1 ? "goal" : "goals"}`}
					tone="neutral"
				/>
			{/if}
		{/snippet}

		<div class="saved-recipe-card__body">
			<div class="saved-recipe-card__meta" aria-label="Saved recipe summary">
				<span>{savedDate}</span>
				<span>{ingredientCountLabel}</span>
			</div>

			{#if recipe.foods.length > 0}
				<SavedRecipeIngredientPills foods={recipe.foods} />
			{:else}
				<p class="saved-recipe-card__no-ingredients">
					No ingredients were saved with this recipe.
				</p>
			{/if}

			<SavedRecipeGoalPills goals={goalProgress} />

			<footer class="saved-recipe-card__actions">
				<RoundedActionButton
					fullWidth
					busy={loading}
					disabled={disabled}
					ariaLabel={`Load ${recipe.name}`}
					onclick={() => onLoad(recipe)}
				>
					Load
				</RoundedActionButton>
				<SavedRecipeExportAction
					{recipe}
					compact
					disabled={disabled}
				/>
				<TwoStepConfirmation
					actionLabel={`Delete ${recipe.name}`}
					confirmationLabel={`Confirm deletion of ${recipe.name}`}
					message="Tap or click delete again to confirm."
					messageId={`saved-recipe-delete-${recipe.id}`}
					disabled={disabled}
					onConfirm={() => onDelete(recipe)}
				>
					{#snippet children({ armed, activate, label, messageId })}
						<CircleIconButton
							label={label}
							variant={armed ? "danger" : "soft"}
							size="control"
							busy={deleting}
							disabled={disabled}
							aria-describedby={armed ? messageId : undefined}
							onclick={activate}
						>
							<Trash size={18} />
						</CircleIconButton>
					{/snippet}
				</TwoStepConfirmation>
			</footer>
		</div>
	</CollapsibleSection>
</article>

<style lang="scss">
	@use "./SavedRecipeCard.scss";
</style>
