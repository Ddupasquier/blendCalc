<script lang="ts">
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import NumberInput from "$lib/components/common/forms/NumberInput/NumberInput.svelte";
	import ListControls from "$lib/components/common/lists/ListControls/ListControls.svelte";
	import { searchNutrientCatalog } from "$lib/utils/mix/nutrients/nutrientSearch";
	import type { NutrientMeta } from "$lib/utils/mix/calculations";
	import type { NutrientPickerProps } from "./types";
	import { getNutrientCatalog } from "$lib/utils/food/reference/appReferenceCatalog";

	let { excludedIds, getGoal, onSelect }: NutrientPickerProps = $props();

	let isOpen = $state(false);
	let query = $state("");
	let pendingNutrient = $state<NutrientMeta | null>(null);
	let targetValue = $state("");
	const nutrientCatalog = getNutrientCatalog();
	const targetAmount = $derived(
		targetValue.trim() === "" ? null : Number(targetValue),
	);
	const hasValidTarget = $derived(
		targetAmount !== null && Number.isFinite(targetAmount) && targetAmount >= 0,
	);

	const availableNutrients = $derived(
		nutrientCatalog.filter(
			(nutrient) =>
				!excludedIds.some((id) => String(id) === String(nutrient.id)),
		),
	);
	const searchResults = $derived(
		searchNutrientCatalog(availableNutrients as NutrientMeta[], query),
	);
	const visibleNutrients = $derived(
		query.trim() ? searchResults : availableNutrients,
	);

	const resetSelection = () => {
		query = "";
		pendingNutrient = null;
		targetValue = "";
	};

	const selectNutrient = (nutrient: NutrientMeta) => {
		if (getGoal(nutrient)) {
			if (onSelect(nutrient.id)) resetSelection();
			return;
		}
		pendingNutrient = nutrient;
		targetValue = "";
	};

	const addCustomGoal = (event: SubmitEvent) => {
		event.preventDefault();
		if (!pendingNutrient || !hasValidTarget || targetAmount === null) return;
		if (onSelect(pendingNutrient.id, targetAmount)) resetSelection();
	};
</script>

<div class="nutrient-picker">
	<CollapsibleSection
		title="Add nutrient"
		open={isOpen}
		onOpenChange={(open) => (isOpen = open)}
	>
		<div class="nutrient-picker__content">
			<ListControls
				id="nutrient-search"
				label="Find a nutrient"
				placeholder="Search vitamins, minerals, fats…"
				{query}
				onQueryChange={(value) => (query = value)}
				totalCount={availableNutrients.length}
				visibleCount={visibleNutrients.length}
				itemLabel="nutrients"
			/>
			{#if pendingNutrient}
				<form class="nutrient-picker__goal-setup" onsubmit={addCustomGoal}>
					<div class="nutrient-picker__goal-copy">
						<strong>Set a target for {pendingNutrient.label}</strong>
						<small>
							There is no reviewed default for this nutrient. Enter the target
							you want Mix to track.
						</small>
					</div>
					<div class="nutrient-picker__goal-controls">
						<NumberInput
							id={`new-goal-${pendingNutrient.id}`}
							name={`new-goal-${pendingNutrient.id}`}
							min="0"
							step="any"
							placeholder={`Target ${pendingNutrient.unit ?? ""}`.trim()}
							ariaLabel={`Goal value for ${pendingNutrient.label} in ${pendingNutrient.unit ?? "its reported unit"}`}
							value={targetValue}
							onValueChange={(value) => (targetValue = value)}
						/>
						<span>{pendingNutrient.unit}</span>
						<ActionButton
							type="submit"
							size="small"
							variant="success"
							disabled={!hasValidTarget}>Add goal</ActionButton
						>
					</div>
				</form>
			{/if}
			{#if visibleNutrients.length > 0}
				<div class="nutrient-picker__results" aria-label="Available nutrients">
					{#each visibleNutrients as nutrient (nutrient.id)}
						<RoundedActionButton
							fullWidth
							contentAlign="space-between"
							variant="neutral"
							onclick={() => selectNutrient(nutrient)}
						>
							<span class="nutrient-picker__label">{nutrient.label}</span>
							<span class="nutrient-picker__unit">{nutrient.unit}</span>
						</RoundedActionButton>
					{/each}
				</div>
			{:else}
				<p class="nutrient-picker__empty">No matching nutrients.</p>
			{/if}
		</div>
	</CollapsibleSection>
</div>

<style lang="scss">
	@use "./NutrientPicker.scss";
</style>
