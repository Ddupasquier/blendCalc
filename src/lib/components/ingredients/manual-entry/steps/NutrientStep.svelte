<script lang="ts">
	import ManualEntryValidationList, {
		type ManualEntryValidationItem,
	} from "$lib/components/ingredients/manual-entry/ManualEntryValidationList.svelte";
	import ManualEntryNutrientFields from "$lib/components/ingredients/manual-entry/ManualEntryNutrientFields.svelte";
	import type {
		ManualEntryNutrientDefinition,
		ManualEntryNutrientGroup,
	} from "$lib/utils/food/nutrients/nutrientDefinitions";

	let {
		groups,
		loading,
		error,
		helper,
		validationItems = [],
		accordion = true,
		defaultOpenFirst = true,
		getValue,
		onValueChange,
		isRequired,
		onBack,
		onNext,
	}: {
		groups: ManualEntryNutrientGroup[];
		loading: boolean;
		error: string;
		helper: string;
		validationItems?: ManualEntryValidationItem[];
		accordion?: boolean;
		defaultOpenFirst?: boolean;
		getValue: (field: ManualEntryNutrientDefinition) => number;
		onValueChange: (field: ManualEntryNutrientDefinition, value: string) => void;
		isRequired: (field: ManualEntryNutrientDefinition) => boolean;
		onBack: () => void;
		onNext: () => void;
	} = $props();
</script>

<div class="custom-ingredient__step">
	<p class="custom-ingredient__helper">{helper}</p>

	<ManualEntryValidationList items={validationItems} />

	<ManualEntryNutrientFields
		{groups}
		{loading}
		{error}
		{accordion}
		{defaultOpenFirst}
		{getValue}
		onValueChange={onValueChange}
		{isRequired}
	/>

	<div class="custom-ingredient__actions">
		<button type="button" class="custom-ingredient__secondary" onclick={onBack}>
			Back
		</button>
		<button type="button" class="custom-ingredient__primary" onclick={onNext}>
			Continue
		</button>
	</div>
</div>
