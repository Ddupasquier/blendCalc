<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
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
	@use "./ManualEntryNutrientFields.scss";
</style>
