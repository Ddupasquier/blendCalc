<script lang="ts">
	import { getNutrientCatalog } from "$lib/utils/food/reference/appReferenceCatalog";
	import X from "$lib/assets/icons/X/X.svelte";
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import MetadataPill from "$lib/components/common/display/MetadataPill/MetadataPill.svelte";
	import NumberInput from "$lib/components/common/forms/NumberInput/NumberInput.svelte";
	import RangeInput from "$lib/components/common/forms/RangeInput/RangeInput.svelte";
	import type { RangeInputTone } from "$lib/components/common/forms/RangeInput/types";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import ToggleSwitch from "$lib/components/common/forms/ToggleSwitch/ToggleSwitch.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import NutrientPicker from "$lib/components/mix/controls/NutrientPicker/NutrientPicker.svelte";
	import {
		evaluateMixGoal,
		getMixGoalOperator,
	} from "$lib/utils/mix/goals/goalEvaluation";
	import type { MixGoalType } from "$lib/utils/mix/goals/types";
	import type { GoalTargetsProps } from "./types";

	let {
		selectedNutrients,
		nutrientGoals,
		goalTemplates,
		selectedGoalTemplateId,
		templateCustomized,
		keepExtraGoals,
		busy = false,
		error = "",
		onTemplateChange,
		onKeepExtraGoalsChange,
		onApplyTemplate,
		onSaveCurrentTemplate,
		onDeleteTemplate,
		onPreviewGoal,
		onUpdateGoal,
		onUpdateUpperGoal,
		onUpdateGoalType,
		onAddNutrient,
		onRemoveNutrient,
		getGoal,
		getTotal,
		open = true,
		onOpenChange,
	}: GoalTargetsProps = $props();

	const nutrientCatalog = getNutrientCatalog();
	const goalTemplateOptions = $derived([
		{ value: "", label: "Choose a goal preset", placeholder: true },
		...goalTemplates.map((template) => ({
			value: template.selectionId,
			label: template.scope === "user" ? `${template.label} · Yours` : template.label,
		})),
	]);
	let templatePreviewOpen = $state(false);
	const selectedTemplate = $derived(
		goalTemplates.find((template) => template.selectionId === selectedGoalTemplateId) ?? null,
	);
	const getNutrientLabel = (nutrientId: number) =>
		nutrientCatalog.find((nutrient) => nutrient.id === nutrientId)?.label ??
		`Nutrient ${nutrientId}`;
	const getStatus = (total: number, goal: Parameters<typeof evaluateMixGoal>[0]) =>
		evaluateMixGoal(goal, total).status;
	const getSliderStep = (defaultGoal: number) => {
		if (defaultGoal >= 100) return 1;
		if (defaultGoal >= 1) return 0.1;
		return 0.01;
	};
	const getSliderMax = (defaultGoal: number, goal: number, step: number) =>
		Math.max(defaultGoal * 2, goal, step * 10);
	const getSliderTone = (status: ReturnType<typeof getStatus>): RangeInputTone => {
		if (status === "met") return "success";
		if (status === "over") return "danger";
		if (status === "under") return "warning";
		return "neutral";
	};
	const goalTypeOptions = [
		{ value: "exact", label: "Target" },
		{ value: "minimum", label: "At least" },
		{ value: "maximum", label: "At most" },
		{ value: "range", label: "Range" },
	];
	const goalSummary = (goal: Parameters<typeof evaluateMixGoal>[0]) => {
		if (goal.goalType === "range") {
			return `${goal.targetAmount}–${goal.upperAmount ?? goal.targetAmount}`;
		}
		return `${getMixGoalOperator(goal)}${goal.targetAmount}`;
	};
	const handleTemplateChange = (templateId: string) => {
		templatePreviewOpen = Boolean(templateId);
		onTemplateChange(templateId);
	};
	const handleApplyTemplate = async () => {
		const applied = await onApplyTemplate();
		if (applied) templatePreviewOpen = false;
	};
</script>

<section class="goals-panel" data-tutorial-target="mix-goals">
	<CollapsibleSection
		title="Goals"
		badge={`${selectedNutrients.length} tracked`}
		{open}
		{onOpenChange}
		surface="panel"
	>
		<div class="goals-content">
			<div class="goal-template-controls">
				<SelectField
					id="goal-template"
					name="goal-template"
					class="goal-template-controls__select"
					label="Goal preset"
					labelVisibility="sr-only"
					size="small"
					value={selectedGoalTemplateId}
					options={goalTemplateOptions}
					onValueChange={handleTemplateChange}
				/>
				<ActionButton
					size="small"
					variant="success"
					onclick={handleApplyTemplate}
					disabled={!selectedGoalTemplateId || busy}
					busy={busy}
				>Apply</ActionButton>
			</div>
			{#if selectedTemplate && templatePreviewOpen}
				<div class="goal-template-preview">
					<div>
						<div class="goal-template-preview__title">
							<strong>{selectedTemplate.label}</strong>
							{#if templateCustomized}
								<MetadataPill label="Customized" tone="neutral" />
							{/if}
						</div>
						<p>{selectedTemplate.description}</p>
					</div>
					<div
						class="goal-template-preview__goals"
						aria-label={`${selectedTemplate.label} goals`}
					>
						{#each Object.values(selectedTemplate.goals).sort((left, right) => left.sortOrder - right.sortOrder) as goal (goal.nutrientId)}
							<MetadataPill
								label={getNutrientLabel(goal.nutrientId)}
								value={goalSummary(goal)}
								tone="soft"
							/>
						{/each}
					</div>
					<label class="goal-template-preview__keep">
						<span>
							<strong>Keep my other goals</strong>
							<small>Preset goals update first; your extra tracked nutrients stay.</small>
						</span>
						<ToggleSwitch
							id="keep-extra-mix-goals"
							checked={keepExtraGoals}
							ariaLabel="Keep goals not included in this preset"
							onChange={onKeepExtraGoalsChange}
						/>
					</label>
					{#if selectedTemplate.scope === "user"}
						<ActionButton
							size="small"
							variant="danger"
							onclick={() => onDeleteTemplate(selectedTemplate.id)}
							disabled={busy}
						>Delete preset</ActionButton>
					{/if}
				</div>
			{/if}
			{#if error}
				<StatusMessage tone="danger" message={error} />
			{/if}
			<div class="goal-grid" aria-label="Nutrient goals">
				{#each selectedNutrients as nutrient}
					{@const total = getTotal(Number(nutrient.id))}
					{@const defaultGoal = getGoal(nutrient)}
					{@const goal = nutrientGoals[Number(nutrient.id)] ?? defaultGoal}
					{@const status = getStatus(total, goal)}
					{@const sliderStep = getSliderStep(defaultGoal.targetAmount)}
					{@const sliderMax = getSliderMax(defaultGoal.targetAmount, goal.targetAmount, sliderStep)}
					<div class="goal-input" data-status={status}>
						<div class="goal-input__summary">
							<div class="goal-input__identity">
								<span class="goal-label">{nutrient.label}</span>
								<SelectField
									id={`goal-${nutrient.id}-type`}
									name={`goal-${nutrient.id}-type`}
									class="goal-input__type"
									label={`Goal rule for ${nutrient.label}`}
									labelVisibility="sr-only"
									size="small"
									width="content"
									value={goal.goalType}
									options={goalTypeOptions}
									onValueChange={(value) => onUpdateGoalType(nutrient.id, value as MixGoalType)}
								/>
							</div>
							<span class="goal-total">
								<strong>{total.toFixed(1)}</strong>
								<span aria-hidden="true">/</span>
								{#if goal.goalType !== "range"}
									<span aria-hidden="true">{getMixGoalOperator(goal)}</span>
								{/if}
								<NumberInput
									id={`goal-${nutrient.id}`}
									name={`goal-${nutrient.id}`}
									class="goal-input__number"
									min="0"
									step="any"
									placeholder={`Target ${nutrient.unit}`}
									ariaLabel={`${goal.goalType === "range" ? "Lower" : "Goal"} value for ${nutrient.label} in ${nutrient.unit}`}
									value={goal.targetAmount}
									onValueChange={(value) => onUpdateGoal(nutrient.id, value)}
								/>
								{#if goal.goalType === "range"}
									<span class="goal-input__range-divider" aria-hidden="true">–</span>
									<NumberInput
										id={`goal-${nutrient.id}-upper`}
										name={`goal-${nutrient.id}-upper`}
										class="goal-input__number"
										min={String(goal.targetAmount)}
										step="any"
										placeholder={`Upper ${nutrient.unit}`}
										ariaLabel={`Upper goal for ${nutrient.label} in ${nutrient.unit}`}
										value={goal.upperAmount ?? goal.targetAmount}
										onValueChange={(value) => onUpdateUpperGoal(nutrient.id, value)}
									/>
								{/if}
								<span class="goal-unit">{nutrient.unit}</span>
							</span>
						</div>
						<RangeInput
							id={`goal-${nutrient.id}-slider`}
							name={`goal-${nutrient.id}-slider`}
							class="goal-input__slider"
							min={0}
							max={sliderMax}
							step={sliderStep}
							value={goal.targetAmount}
							fillValue={total}
							tone={getSliderTone(status)}
							ariaLabel={`Set ${nutrient.label} goal`}
							ariaValueText={`${goalSummary(goal)}${nutrient.unit} goal; ${total.toFixed(1)}${nutrient.unit} current`}
							onValueChange={(value) => onPreviewGoal(nutrient.id, String(value))}
							onValueCommit={(value) => onUpdateGoal(nutrient.id, String(value))}
						/>
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
			<RoundedActionButton
				variant="outline"
				fullWidth
				onclick={onSaveCurrentTemplate}
				disabled={selectedNutrients.length === 0 || busy}
			>Save current goals as a preset</RoundedActionButton>
			{#if selectedNutrients.length === 0}
				<MetadataPill label="Add at least one nutrient to build a shape" tone="warning" />
			{/if}
		</div>
	</CollapsibleSection>
</section>

<style lang="scss">
	@use "./GoalTargets.scss";
</style>
