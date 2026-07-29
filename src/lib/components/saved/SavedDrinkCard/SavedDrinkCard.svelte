<script lang="ts">
	import Trash from "$lib/assets/icons/Trash/Trash.svelte";
	import TwoStepConfirmation from "$lib/components/common/actions/TwoStepConfirmation/TwoStepConfirmation.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import MetadataPill from "$lib/components/common/display/MetadataPill/MetadataPill.svelte";
	import {
		getSavedDrinkCalories,
		getSavedDrinkGoalProgress,
		getSavedDrinkOverallGoalScore,
	} from "$lib/utils/recipes/savedDrinkPresentation";
	import SavedDrinkExportAction from "../SavedDrinkExportAction/SavedDrinkExportAction.svelte";
	import SavedDrinkGoalPills from "../SavedDrinkGoalPills/SavedDrinkGoalPills.svelte";
	import SavedDrinkIngredientPills from "../SavedDrinkIngredientPills/SavedDrinkIngredientPills.svelte";
	import type { SavedDrinkCardProps } from "./types";

	let {
		drink,
		loading = false,
		deleting = false,
		disabled = false,
		onLoad,
		onDelete,
	}: SavedDrinkCardProps = $props();

	const titleId = $derived(`saved-drink-${drink.id}-title`);
	const calories = $derived(getSavedDrinkCalories(drink));
	const goalProgress = $derived(getSavedDrinkGoalProgress(drink));
	const overallGoalScore = $derived(getSavedDrinkOverallGoalScore(drink));
	const savedDate = $derived(
		new Intl.DateTimeFormat(undefined, {
			month: "short",
			day: "numeric",
			year: "numeric",
		}).format(new Date(drink.createdAt)),
	);
	const ingredientCountLabel = $derived(
		`${drink.foods.length} ${drink.foods.length === 1 ? "ingredient" : "ingredients"}`,
	);
</script>

<article class="saved-drink-card" aria-labelledby={titleId}>
	<CollapsibleSection
		title={drink.name}
		{titleId}
		surface="panel"
		class="saved-drink-card__collapse"
	>
		{#snippet summaryEnd()}
			{#if calories !== null}
				<MetadataPill
					class="saved-drink-card__calories"
					label={`${calories} kcal`}
					tone="success"
				/>
			{/if}
			{#if overallGoalScore}
				<MetadataPill
					class="saved-drink-card__goal-score"
					label={`${overallGoalScore.percent}%`}
					ariaLabel={`Overall goal match ${overallGoalScore.percent}% across ${overallGoalScore.goalCount} ${overallGoalScore.goalCount === 1 ? "goal" : "goals"}`}
					tone="neutral"
				/>
			{/if}
		{/snippet}

		<div class="saved-drink-card__body">
			<div class="saved-drink-card__meta" aria-label="Saved mix summary">
				<span>{savedDate}</span>
				<span>{ingredientCountLabel}</span>
			</div>

			{#if drink.foods.length > 0}
				<SavedDrinkIngredientPills foods={drink.foods} />
			{:else}
				<p class="saved-drink-card__no-ingredients">
					No ingredients were saved with this mix.
				</p>
			{/if}

			<SavedDrinkGoalPills goals={goalProgress} />

			<footer class="saved-drink-card__actions">
				<RoundedActionButton
					fullWidth
					busy={loading}
					disabled={disabled}
					ariaLabel={`Load ${drink.name}`}
					onclick={() => onLoad(drink)}
				>
					Load
				</RoundedActionButton>
				<SavedDrinkExportAction
					{drink}
					compact
					disabled={disabled}
				/>
				<TwoStepConfirmation
					actionLabel={`Delete ${drink.name}`}
					confirmationLabel={`Confirm deletion of ${drink.name}`}
					message="Tap or click delete again to confirm."
					messageId={`saved-drink-delete-${drink.id}`}
					disabled={disabled}
					onConfirm={() => onDelete(drink)}
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
	@use "./SavedDrinkCard.scss";
</style>
