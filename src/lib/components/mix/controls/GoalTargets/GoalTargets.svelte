<script lang="ts">
	import { getMixGoalTemplates } from "$lib/utils/food/reference/appReferenceCatalog";
	import X from "$lib/assets/icons/X/X.svelte";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import MetadataPill from "$lib/components/common/display/MetadataPill/MetadataPill.svelte";
	import NumberInput from "$lib/components/common/forms/NumberInput/NumberInput.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import NutrientPicker from "$lib/components/mix/controls/NutrientPicker/NutrientPicker.svelte";
	import type { GoalTargetsProps } from "./types";

	let {
		selectedNutrients,
		nutrientGoals,
		selectedGoalTemplateId,
		onTemplateChange,
		onApplyTemplate,
		onUpdateGoal,
		onAddNutrient,
		onRemoveNutrient,
		getGoal,
		getTotal,
		open = true,
		onOpenChange,
	}: GoalTargetsProps = $props();

	const goalTemplates = getMixGoalTemplates();
	const goalTemplateOptions = [
		{ value: "", label: "Choose preset" },
		...goalTemplates.map((template) => ({
			value: template.id,
			label: template.label,
		})),
	];
	const getStatus = (total: number, goal: number) => {
		if (goal <= 0) return "unset";
		const difference = total - goal;
		const tolerance = Math.max(goal * 0.05, 0.05);
		if (Math.abs(difference) <= tolerance) return "near";
		return difference > 0 ? "over" : "under";
	};
	const getProgressWidth = (total: number, goal: number) =>
		goal > 0 ? `${Math.min((total / goal) * 100, 100)}%` : "0%";
</script>

<section class="goals-panel" data-tutorial-target="mix-goals">
	<CollapsibleSection
		title="Goals"
		badge={`${selectedNutrients.length} tracked`}
		{open}
		{onOpenChange}
		surface="panel"
	>
		<div class="goal-template-controls">
			<SelectField
				id="goal-template"
				name="goal-template"
				class="goal-template-controls__select"
				label="Template"
				size="compact"
				value={selectedGoalTemplateId}
				options={goalTemplateOptions}
				onValueChange={onTemplateChange}
			/>
			<ActionButton
				size="small"
				variant="secondary"
				onclick={onApplyTemplate}
				disabled={!selectedGoalTemplateId}
			>Apply</ActionButton>
		</div>
		<div class="goal-grid" aria-label="Nutrient goals">
			{#each selectedNutrients as nutrient}
				{@const total = getTotal(Number(nutrient.id))}
				{@const goal = nutrientGoals[Number(nutrient.id)] ?? getGoal(nutrient)}
				{@const status = getStatus(total, goal)}
				<div class="goal-input" data-status={status}>
					<div class="goal-input__summary">
						<span class="goal-label">{nutrient.label}</span>
						<span class="goal-total">
							<strong>{total.toFixed(1)}</strong> / {goal}{nutrient.unit}
						</span>
					</div>
					<span class="goal-progress" aria-hidden="true">
						<span style={`width: ${getProgressWidth(total, goal)}`}></span>
					</span>
					<label class="goal-input__control" for={`goal-${nutrient.id}`}>
						<span class="visually-hidden">Goal for {nutrient.label}</span>
				<NumberInput
					id={`goal-${nutrient.id}`}
					name={`goal-${nutrient.id}`}
					class="goal-input__number"
					min="0"
					step="any"
					placeholder={`Target ${nutrient.unit}`}
					value={goal}
					onValueChange={(value) => onUpdateGoal(nutrient.id, value)}
				/>
						<span class="goal-unit">{nutrient.unit}</span>
					</label>
					<CircleIconButton
						class="goal-input__remove"
						label={`Stop tracking ${nutrient.label}`}
						variant="soft"
						size="small"
						onclick={() => onRemoveNutrient(nutrient.id)}
					>
						<X size={15} />
					</CircleIconButton>
				</div>
			{/each}
		</div>
		<NutrientPicker
			excludedIds={selectedNutrients.map((nutrient) => nutrient.id)}
			onSelect={onAddNutrient}
		/>
		{#if selectedNutrients.length === 0}
			<MetadataPill label="Add at least one nutrient to build a shape" tone="warning" />
		{/if}
	</CollapsibleSection>
</section>

<style lang="scss">
	@use "./GoalTargets.scss";
</style>
