<script lang="ts">
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import ListControls from "$lib/components/common/lists/ListControls/ListControls.svelte";
	import { searchCompatibleNutrients } from "$lib/utils/moderation/compatibleNutrientSearch";
	import type { CompatibleNutrientPickerProps } from "./types";

	let {
		nutrients,
		selectedNutrientId,
		disabled = false,
		onValueChange,
	}: CompatibleNutrientPickerProps = $props();
	let query = $state("");

	const matchingNutrients = $derived(
		searchCompatibleNutrients(nutrients, query),
	);
	const selectedNutrient = $derived(
		nutrients.find(
			(nutrient) => String(nutrient.nutrientId) === selectedNutrientId,
		) ?? null,
	);
	const resultSummary = $derived(
		query.trim()
			? `${matchingNutrients.length} of ${nutrients.length} compatible nutrients match`
			: `${nutrients.length} compatible nutrients available`,
	);
</script>

<fieldset class="compatible-nutrient-picker" {disabled}>
	<legend>Confirmed nutrient</legend>
	<input type="hidden" name="selectedNutrientId" value={selectedNutrientId} />

	<div class="compatible-nutrient-picker__selection" aria-live="polite">
		<span>Current selection</span>
		{#if selectedNutrient}
			<strong>
				{selectedNutrient.nutrientName} · {selectedNutrient.defaultUnitName}
			</strong>
		{:else}
			<strong>No nutrient selected yet</strong>
		{/if}
	</div>

	<ListControls
		id="nutrient-mapping-search"
		label="Find a compatible nutrient"
		placeholder="Search nutrient name, number, or ID"
		{query}
		onQueryChange={(value) => (query = value)}
		totalCount={nutrients.length}
		visibleCount={matchingNutrients.length}
		itemLabel="compatible nutrients"
		{resultSummary}
	/>
	<p class="compatible-nutrient-picker__help">
		Search narrows the choices below. It never changes your current selection.
		Only nutrients with the same unit or a reviewed conversion are available.
	</p>

	{#if matchingNutrients.length > 0}
		<div
			class="compatible-nutrient-picker__results"
			aria-label="Compatible nutrient choices"
		>
			{#each matchingNutrients as nutrient (nutrient.nutrientId)}
				<RoundedActionButton
					fullWidth
					contentAlign="space-between"
					variant={String(nutrient.nutrientId) === selectedNutrientId
						? "primary"
						: "neutral"}
					aria-pressed={String(nutrient.nutrientId) === selectedNutrientId}
					{disabled}
					onclick={() => onValueChange(String(nutrient.nutrientId))}
				>
					<span class="compatible-nutrient-picker__name">
						{nutrient.nutrientName}
					</span>
					<span class="compatible-nutrient-picker__metadata">
						{nutrient.nutrientNumber ?? nutrient.nutrientId} ·
						{nutrient.defaultUnitName}
					</span>
				</RoundedActionButton>
			{/each}
		</div>
	{:else}
		<p class="compatible-nutrient-picker__empty" role="status">
			No compatible nutrient matches “{query.trim()}.” Your current selection is
			unchanged. Clear the search to see every compatible choice.
		</p>
	{/if}
</fieldset>

<style lang="scss">
	@use "./CompatibleNutrientPicker.scss";
</style>
