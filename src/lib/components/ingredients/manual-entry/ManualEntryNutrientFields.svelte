<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron.svelte";
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner.svelte";
	import type { ManualEntryNutrientFieldsProps } from "$lib/components/ingredients/manual-entry/formTypes";
	import type {
		ManualEntryNutrientDefinition,
		ManualEntryNutrientGroup,
	} from "$lib/utils/food/nutrients/nutrientDefinitions";

	let {
		groups,
		loading = false,
		error = "",
		accordion = true,
		defaultOpenFirst = true,
		getValue,
		onValueChange,
		isRequired = () => false,
	}: ManualEntryNutrientFieldsProps = $props();

	const toDomSafeId = (value: string | number) =>
		String(value)
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9_-]+/g, "-")
			.replace(/^-+|-+$/g, "");

	const getInputId = (field: ManualEntryNutrientDefinition) =>
		`manual-entry-nutrient-${toDomSafeId(field.dedupeKey || field.nutrientId)}`;

	const isOptionalGroup = (group: ManualEntryNutrientGroup) =>
		group.fields.every((field) => !isRequired(field));

	const getInputValue = (field: ManualEntryNutrientDefinition) => {
		const value = getValue(field);
		return Number.isFinite(value) ? value : "";
	};
</script>

{#if loading}
	<div class="manual-nutrients__status">
		<LoadingSpinner label="Loading nutrient fields" showLabel />
	</div>
{:else if error}
	<p class="manual-nutrients__status manual-nutrients__status--error" role="alert">
		{error}
	</p>
{:else if groups.length === 0}
	<p class="manual-nutrients__status" role="status">
		Nutrient fields are unavailable right now.
	</p>
{:else}
	<div class="manual-nutrients">
		{#each groups as group, index}
			{#if accordion}
				<details class="manual-nutrients__group" open={defaultOpenFirst && index === 0}>
					<summary>
						<span class="manual-nutrients__group-title">
							{group.title}
							{#if isOptionalGroup(group)}
								<small>optional</small>
							{/if}
						</span>
						<span class="manual-nutrients__chevron" aria-hidden="true">
							<Chevron direction="down" />
						</span>
					</summary>
					<div class="manual-nutrients__fields">
						{#each group.fields as field (field.dedupeKey || field.nutrientId)}
							<label for={getInputId(field)}>
								<span>
									{field.label}
									{#if isRequired(field)}
										<em>*</em>
									{/if}
								</span>
								<input
									id={getInputId(field)}
									name={getInputId(field)}
									type="number"
									min="0"
									step="any"
									placeholder="0"
									aria-required={isRequired(field)}
									value={getInputValue(field)}
									onfocus={(event) => event.currentTarget.select()}
									oninput={(event) => onValueChange(field, event.currentTarget.value)}
								/>
							</label>
						{/each}
					</div>
				</details>
			{:else}
				<section class="manual-nutrients__group manual-nutrients__group--static">
					{#if groups.length > 1}
						<h3>
							<span class="manual-nutrients__group-title">
								{group.title}
								{#if isOptionalGroup(group)}
									<small>optional</small>
								{/if}
							</span>
						</h3>
					{/if}
					<div class="manual-nutrients__fields">
						{#each group.fields as field (field.dedupeKey || field.nutrientId)}
							<label for={getInputId(field)}>
								<span>
									{field.label}
									{#if isRequired(field)}
										<em>*</em>
									{/if}
								</span>
								<input
									id={getInputId(field)}
									name={getInputId(field)}
									type="number"
									min="0"
									step="any"
									placeholder="0"
									aria-required={isRequired(field)}
									value={getInputValue(field)}
									onfocus={(event) => event.currentTarget.select()}
									oninput={(event) => onValueChange(field, event.currentTarget.value)}
								/>
							</label>
						{/each}
					</div>
				</section>
			{/if}
		{/each}
	</div>
{/if}

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.manual-nutrients,
	.manual-nutrients__fields {
		display: grid;
		gap: $app-vertical-stack-gap;
	}

	.manual-nutrients__group {
		padding: 0;
		background: transparent;
		border: 0;

		summary,
		h3 {
			display: flex;
			align-items: center;
			justify-content: space-between;
			min-height: $ingredient-control-height;
			padding: 0 $ingredient-control-padding-x;
			margin: 0 0 $app-gap-md;
			color: $ingredient-text-primary;
			background: $ingredient-surface-positive;
			border-radius: $ingredient-radius-pill;
			font-family: $app-font-family-interface;
			font-size: $app-font-size-md;
			font-weight: $app-font-weight-bold;
			list-style: none;
			cursor: pointer;
		}

		summary::-webkit-details-marker {
			display: none;
		}

		.manual-nutrients__chevron {
			display: inline-grid;
			place-items: center;
			width: $ingredient-control-icon-size;
			height: $ingredient-control-icon-size;
			color: $ingredient-text-muted;
			line-height: 1;
			transform: rotate(180deg);
			transition: transform 160ms ease;
		}

		&:not([open]) .manual-nutrients__chevron {
			transform: rotate(0deg);
		}
	}

	.manual-nutrients__group-title {
		display: inline-flex;
		align-items: center;
		gap: $app-gap-xs;

		small {
			padding: $ingredient-badge-padding-y $ingredient-badge-padding-x;
			color: $ingredient-text-muted;
			background: $ingredient-surface-control;
			border-radius: $ingredient-radius-pill;
			font-size: $app-font-size-xs;
			font-weight: $app-font-weight-medium;
			text-transform: none;
		}
	}

	.manual-nutrients__group--static {
		h3 {
			cursor: default;
		}
	}

	label {
		display: grid;
		gap: $app-gap-sm;
		color: $ingredient-text-muted;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
		text-transform: uppercase;

		span {
			display: inline-flex;
			align-items: center;
			gap: $app-gap-xs;
			letter-spacing: $app-letter-spacing-data;
		}

		em {
			color: $ingredient-accent-danger;
			font-style: normal;
		}
	}

	input {
		width: 100%;
		min-width: 0;
		min-height: $ingredient-control-height;
		padding: 0 $ingredient-control-padding-x;
		color: $ingredient-text-primary;
		background: $ingredient-surface-soft;
		border: 0;
		border-radius: $ingredient-radius-pill;
		font: inherit;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-medium;
		text-transform: none;
	}

	.manual-nutrients__status {
		margin: 0;
		padding: $app-gap-md;
		color: $ingredient-text-muted;
		background: $ingredient-surface-soft;
		border-radius: $ingredient-radius-sheet;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-semibold;
	}

	.manual-nutrients__status--error {
		color: $ingredient-accent-danger;
		background: $app-danger-bg;
	}
</style>
