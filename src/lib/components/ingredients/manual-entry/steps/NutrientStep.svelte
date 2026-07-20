<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton.svelte";
	import ManualEntryValidationList from "$lib/components/ingredients/manual-entry/ManualEntryValidationList.svelte";
	import ManualEntryNutrientFields from "$lib/components/ingredients/manual-entry/ManualEntryNutrientFields.svelte";
	import NutritionLabelOcrInput from "$lib/components/ingredients/manual-entry/NutritionLabelOcrInput.svelte";
	import type { NutrientStepProps } from "$lib/components/ingredients/manual-entry/formTypes";

	let {
		groups,
		loading,
		error,
		helper,
		validationItems = [],
		accordion = true,
		defaultOpenFirst = true,
		hideUnavailableStatus = false,
		labelOcrMappings,
		labelOcrMappingError = "",
		nutritionPhoto = null,
		onNutritionPhotoChange,
		onApplyNutritionLabelOcr,
		getValue,
		onValueChange,
		isRequired,
		onBack,
		onNext,
	}: NutrientStepProps = $props();
</script>

<div class="custom-ingredient__step">
	<p class="custom-ingredient__helper">{helper}</p>

	{#if labelOcrMappings && onNutritionPhotoChange && onApplyNutritionLabelOcr}
		<NutritionLabelOcrInput
			mappings={labelOcrMappings}
			photo={nutritionPhoto}
			onPhotoChange={onNutritionPhotoChange}
			onApply={onApplyNutritionLabelOcr}
		/>
		{#if labelOcrMappingError}
			<p class="custom-ingredient__field-status custom-ingredient__field-status--error" role="status">
				{labelOcrMappingError}
			</p>
		{/if}
	{/if}

	<ManualEntryValidationList items={validationItems} />

	{#if !hideUnavailableStatus || loading || groups.length > 0}
		<ManualEntryNutrientFields
			{groups}
			{loading}
			error={hideUnavailableStatus ? "" : error}
			{accordion}
			{defaultOpenFirst}
			{getValue}
			onValueChange={onValueChange}
			{isRequired}
		/>
	{/if}

	<div class="custom-ingredient__actions">
		<RoundedActionButton variant="neutral" onclick={onBack}>
			Back
		</RoundedActionButton>
		<RoundedActionButton onclick={onNext}>
			Continue
		</RoundedActionButton>
	</div>
</div>
