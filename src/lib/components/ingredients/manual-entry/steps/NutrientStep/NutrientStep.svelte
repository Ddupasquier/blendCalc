<script lang="ts">
	import ManualEntryActions from "$lib/components/ingredients/manual-entry/ManualEntryActions/ManualEntryActions.svelte";
	import ManualEntryHelpText from "$lib/components/ingredients/manual-entry/ManualEntryHelpText/ManualEntryHelpText.svelte";
	import ManualEntryStepLayout from "$lib/components/ingredients/manual-entry/ManualEntryStepLayout/ManualEntryStepLayout.svelte";
	import ManualEntryValidationList from "$lib/components/ingredients/manual-entry/ManualEntryValidationList/ManualEntryValidationList.svelte";
	import ManualEntryNutrientFields from "$lib/components/ingredients/manual-entry/ManualEntryNutrientFields/ManualEntryNutrientFields.svelte";
	import NutritionLabelOcrInput from "$lib/components/ingredients/manual-entry/NutritionLabelOcrInput/NutritionLabelOcrInput.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import type { NutrientStepProps } from "./types";

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
		getGroupBadge,
		onBack,
		onNext,
	}: NutrientStepProps = $props();
</script>

<ManualEntryStepLayout>
	<ManualEntryHelpText>{helper}</ManualEntryHelpText>

	{#if labelOcrMappings && onNutritionPhotoChange && onApplyNutritionLabelOcr}
		<NutritionLabelOcrInput
			mappings={labelOcrMappings}
			photo={nutritionPhoto}
			onPhotoChange={onNutritionPhotoChange}
			onApply={onApplyNutritionLabelOcr}
		/>
		{#if labelOcrMappingError}
			<StatusMessage tone="danger" message={labelOcrMappingError} />
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
			{onValueChange}
			{isRequired}
			{getGroupBadge}
		/>
	{/if}

	<ManualEntryActions {onBack} {onNext} />
</ManualEntryStepLayout>
