<script lang="ts">
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import NumberInput from "$lib/components/common/forms/NumberInput/NumberInput.svelte";
	import type { ManualEntryNutrientFieldsProps } from "./types";
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
				<CollapsibleSection
					title={group.title}
					badge={isOptionalGroup(group) ? "optional" : undefined}
					open={defaultOpenFirst && index === 0}
					class="manual-nutrients__group"
				>
					<div class="manual-nutrients__fields">
						{#each group.fields as field (field.dedupeKey || field.nutrientId)}
							<label for={getInputId(field)}>
								<span>
									{field.label}
									{#if isRequired(field)}
										<em>*</em>
									{/if}
								</span>
								<NumberInput
									id={getInputId(field)}
									name={getInputId(field)}
									class="manual-nutrients__input"
									min="0"
									step="any"
									placeholder="0"
									ariaRequired={isRequired(field)}
									value={getInputValue(field)}
									onValueChange={(value) => onValueChange(field, value)}
								/>
							</label>
						{/each}
					</div>
				</CollapsibleSection>
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
								<NumberInput
									id={getInputId(field)}
									name={getInputId(field)}
									class="manual-nutrients__input"
									min="0"
									step="any"
									placeholder="0"
									ariaRequired={isRequired(field)}
									value={getInputValue(field)}
									onValueChange={(value) => onValueChange(field, value)}
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
	@use "./ManualEntryNutrientFields.scss";
</style>
