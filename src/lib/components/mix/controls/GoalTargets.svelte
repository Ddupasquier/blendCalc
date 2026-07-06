<script lang="ts">
	import { GOAL_TEMPLATES } from "../../../../defaults/mixDefaults";
	import type { NutrientMeta } from "$lib/utils/mix/calculations";

	let {
		selectedNutrients,
		nutrientGoals,
		selectedGoalTemplateId,
		onTemplateChange,
		onApplyTemplate,
		onUpdateGoal,
		getGoal,
		getTotal,
	}: {
		selectedNutrients: NutrientMeta[];
		nutrientGoals: Record<number, number>;
		selectedGoalTemplateId: string;
		onTemplateChange: (templateId: string) => void;
		onApplyTemplate: () => void;
		onUpdateGoal: (id: string | number, value: string) => void;
		getGoal: (nutrient: NutrientMeta) => number;
		getTotal: (nutrientId: number) => number;
	} = $props();
</script>

<section class="setup-card setup-card--goals">
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
				{#each GOAL_TEMPLATES as template}
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
				<input
					id={`goal-${nutrient.id}`}
					name={`goal-${nutrient.id}`}
					type="number"
					min="0"
					step="any"
					value={nutrientGoals[Number(nutrient.id)] ?? getGoal(nutrient)}
					oninput={(event) =>
						onUpdateGoal(nutrient.id, event.currentTarget.value)}
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
	@use "../../../../styles/variables" as *;

	.setup-card {
		padding: $app-gap-sm;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-card-radius;
	}

	.section-heading {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: $app-gap-sm;
		margin-bottom: $app-gap-sm;

		> div:first-child {
			min-width: 0;
		}

		h4 {
			color: $app-primary;
			font-size: $app-font-size-lg;
			font-weight: 800;
		}

		p {
			color: $app-muted;
			font-size: $app-font-size-sm;
			line-height: 1.35;
		}
	}

	.goal-template-controls {
		display: grid;
		grid-template-columns: minmax(8.5rem, 1fr) auto;
		gap: 0.35rem;
		min-width: min(100%, 15rem);

		label {
			grid-column: 1 / -1;
			color: $app-muted;
			font-size: $app-font-size-xs;
			font-weight: 800;
		}

		select {
			width: 100%;
			min-width: 0;
			height: $app-control-height-sm;
			padding: 0 0.5rem;
			color: $app-primary;
			background: $app-section-bg;
			border: $app-border;
			border-radius: $app-radius-sm;
			font-size: $app-font-size-sm;
		}

		button {
			height: $app-control-height-sm;
			padding: 0 0.6rem;
			color: $app-primary;
			background: $app-btn-bg;
			border-radius: $app-radius-sm;
			font-size: $app-font-size-sm;
			font-weight: $app-button-font-weight;
			line-height: $app-button-line-height;

			&:hover:not(:disabled) {
				background: $app-btn-bg-hover;
			}

			&:disabled {
				cursor: not-allowed;
				background: $app-btn-disabled;
			}
		}
	}

	.goal-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
		gap: 0.45rem;
	}

	.goal-input {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.35rem;
		min-width: 0;
		padding: 0.42rem 0.55rem;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-radius;
		color: $app-primary;
		font-size: $app-font-size-sm;
		font-weight: 800;

		.goal-label {
			grid-column: 1;
			grid-row: 1;
			min-width: 0;
			line-height: 1.2;
			overflow-wrap: normal;
			word-break: normal;
		}

		input {
			width: 100%;
			min-width: 0;
			height: $app-control-height-sm;
			padding: 0 0.45rem;
			color: $app-primary;
			background: $app-bg;
			border: $app-border;
			border-radius: $app-radius-sm;
			font-family: $app-font-family-data;
			font-size: $app-font-size-md;
			font-variant-numeric: tabular-nums;
		}

		.goal-unit {
			min-width: 0;
			color: $app-muted;
			font-size: $app-font-size-sm;
		}

		small {
			grid-column: 2;
			grid-row: 1;
			align-self: start;
			color: $app-muted;
			font-family: $app-font-family-data;
			font-size: $app-font-size-xs;
			font-weight: $app-font-weight-medium;
			font-variant-numeric: tabular-nums;
			line-height: 1.2;
			text-align: right;
			white-space: nowrap;
		}
	}

	@media (max-width: $app-breakpoint-md) {
		.section-heading {
			display: grid;
		}

		.goal-template-controls {
			min-width: 0;
		}
	}

	@media (max-width: $app-breakpoint-xs) {
		.goal-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
