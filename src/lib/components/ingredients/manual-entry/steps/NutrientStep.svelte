<script lang="ts">
	import ManualEntryNutrientFields from "$lib/components/ingredients/manual-entry/ManualEntryNutrientFields.svelte";
	import type {
		ManualEntryNutrientDefinition,
		ManualEntryNutrientGroup,
	} from "$lib/utils/food/nutrientDefinitions";

	let {
		groups,
		loading,
		error,
		helper,
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
