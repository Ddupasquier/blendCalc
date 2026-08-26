<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
	import X from "$lib/assets/icons/X/X.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import SettingsSelectionRow from "$lib/components/common/display/SettingsSelectionRow/SettingsSelectionRow.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import type { ProfileNutrientPrioritySettingsProps } from "./types";

	let {
		options,
		selectedNutrientIds,
		disabled,
		onSelectionChange,
	}: ProfileNutrientPrioritySettingsProps = $props();

	let nutrientToAdd = $state("");
	const optionById = $derived(
		new Map(options.map((option) => [option.id, option])),
	);
	const selectedOptions = $derived(
		selectedNutrientIds.flatMap((nutrientId) => {
			const option = optionById.get(nutrientId);
			return option ? [option] : [];
		}),
	);
	const knownSelectedNutrientIds = $derived(
		selectedOptions.map((option) => option.id),
	);
	const availableOptions = $derived(
		options.filter((option) => !knownSelectedNutrientIds.includes(option.id)),
	);
	const defaultNutrientIds = $derived(
		options
			.filter((option) => option.highlight)
			.sort((left, right) => left.sortOrder - right.sortOrder)
			.map((option) => option.id),
	);
	const selectionMatchesDefaults = $derived(
		knownSelectedNutrientIds.join(",") === defaultNutrientIds.join(","),
	);

	const addNutrient = () => {
		const nutrientId = Number(nutrientToAdd);
		if (
			!Number.isInteger(nutrientId) ||
			knownSelectedNutrientIds.includes(nutrientId)
		) {
			return;
		}
		onSelectionChange([...knownSelectedNutrientIds, nutrientId]);
		nutrientToAdd = "";
	};

	const moveNutrient = (nutrientId: number, direction: -1 | 1) => {
		const currentIndex = knownSelectedNutrientIds.indexOf(nutrientId);
		const nextIndex = currentIndex + direction;
		if (
			currentIndex < 0 ||
			nextIndex < 0 ||
			nextIndex >= knownSelectedNutrientIds.length
		) {
			return;
		}
		const nextSelection = [...knownSelectedNutrientIds];
		[nextSelection[currentIndex], nextSelection[nextIndex]] = [
			nextSelection[nextIndex],
			nextSelection[currentIndex],
		];
		onSelectionChange(nextSelection);
	};

	const removeNutrient = (nutrientId: number) => {
		onSelectionChange(
			knownSelectedNutrientIds.filter((id) => id !== nutrientId),
		);
	};
</script>

<fieldset class="profile-nutrient-priority-settings">
	<legend class="sr-only">Nutrient display priority</legend>

	{#each knownSelectedNutrientIds as nutrientId}
		<input type="hidden" name="prioritizedNutrientIds" value={nutrientId} />
	{/each}

	{#if selectedOptions.length}
		<div class="profile-nutrient-priority-settings__selected">
			{#each selectedOptions as nutrient, index (nutrient.id)}
				<SettingsSelectionRow
					title={`${index + 1}. ${nutrient.label}`}
					description={nutrient.defaultGoal === null
						? "Display emphasis only · no default target configured"
						: `Default Mix target: ${nutrient.defaultGoal} ${nutrient.unit}`}
				>
					{#snippet actions()}
						<CircleIconButton
							label={`Move ${nutrient.label} up`}
							variant="ghost"
							size="tiny"
							disabled={disabled || index === 0}
							onclick={() => moveNutrient(nutrient.id, -1)}
						>
							<Chevron direction="up" size={14} />
						</CircleIconButton>
						<CircleIconButton
							label={`Move ${nutrient.label} down`}
							variant="ghost"
							size="tiny"
							disabled={disabled || index === selectedOptions.length - 1}
							onclick={() => moveNutrient(nutrient.id, 1)}
						>
							<Chevron direction="down" size={14} />
						</CircleIconButton>
						<CircleIconButton
							label={`Remove ${nutrient.label}`}
							variant="ghost"
							size="tiny"
							{disabled}
							onclick={() => removeNutrient(nutrient.id)}
						>
							<X size={14} />
						</CircleIconButton>
					{/snippet}
				</SettingsSelectionRow>
			{/each}
		</div>
	{:else}
		<p class="profile-nutrient-priority-settings__empty">
			No nutrient priorities saved.
		</p>
	{/if}

	{#if availableOptions.length}
		<div class="profile-nutrient-priority-settings__add">
			<SelectField
				id="profile-priority-nutrient"
				label="Add a nutrient priority"
				value={nutrientToAdd}
				options={[
					{ value: "", label: "Choose a nutrient", placeholder: true },
					...availableOptions.map((nutrient) => ({
						value: String(nutrient.id),
						label: `${nutrient.label} (${nutrient.unit})`,
					})),
				]}
				{disabled}
				onValueChange={(value) => (nutrientToAdd = value)}
			/>
			<RoundedActionButton
				type="button"
				variant="neutral"
				disabled={disabled || !nutrientToAdd}
				onclick={addNutrient}
			>
				Add priority
			</RoundedActionButton>
		</div>
	{/if}

	{#if !selectionMatchesDefaults}
		<div class="profile-nutrient-priority-settings__actions">
			<RoundedActionButton
				type="button"
				variant="quiet"
				{disabled}
				onclick={() => onSelectionChange(defaultNutrientIds)}
			>
				Restore priority defaults
			</RoundedActionButton>
		</div>
	{/if}
</fieldset>

<style lang="scss">
	@use "./ProfileNutrientPrioritySettings.scss";
</style>
