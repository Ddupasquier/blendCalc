<script lang="ts">
	import { getMixGoalTemplates } from "$lib/utils/food/reference/appReferenceCatalog";
	import NumberInput from "$lib/components/common/forms/NumberInput/NumberInput.svelte";
	import type { GoalTargetsProps } from "./types";

	let {
		selectedNutrients,
		nutrientGoals,
		selectedGoalTemplateId,
		onTemplateChange,
		onApplyTemplate,
		onUpdateGoal,
		getGoal,
		getTotal,
	}: GoalTargetsProps = $props();

	const goalTemplates = getMixGoalTemplates();
</script>

<section
	class="setup-card setup-card--goals"
	data-tutorial-target="mix-goals"
>
	<div class="section-heading">
		<div>
			<h4>Goal Targets</h4>
			<p>Set the target amount for each selected nutrient.</p>
		</div>
		<div class="goal-template-controls">
			<label for="goal-template">Template</label>
			<select
				id="goal-template"
				name="goal-template"
				value={selectedGoalTemplateId}
				onchange={(event) => onTemplateChange(event.currentTarget.value)}
			>
				<option value="">Choose preset</option>
				{#each goalTemplates as template}
					<option value={template.id}>{template.label}</option>
				{/each}
			</select>
			<button
				type="button"
				onclick={onApplyTemplate}
				disabled={!selectedGoalTemplateId}>Apply</button
			>
		</div>
	</div>
	<div class="goal-grid" aria-label="Nutrient goals">
		{#each selectedNutrients as nutrient}
			<label class="goal-input">
				<span class="goal-label">{nutrient.label}</span>
				<NumberInput
					id={`goal-${nutrient.id}`}
					name={`goal-${nutrient.id}`}
					class="goal-input__number"
					min="0"
					step="any"
					placeholder={`Target ${nutrient.unit}`}
					value={nutrientGoals[Number(nutrient.id)] ?? getGoal(nutrient)}
					onValueChange={(value) => onUpdateGoal(nutrient.id, value)}
				/>
				<span class="goal-unit">{nutrient.unit}</span>
				<small>
					{getTotal(Number(nutrient.id)).toFixed(1)} /
					{nutrientGoals[Number(nutrient.id)] ?? getGoal(nutrient)}
				</small>
			</label>
		{/each}
	</div>
</section>

<style lang="scss">
	@use "./GoalTargets.scss";
</style>
