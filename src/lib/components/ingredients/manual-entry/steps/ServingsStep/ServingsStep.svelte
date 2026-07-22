<script lang="ts">
	import ToggleSwitch from "$lib/components/common/forms/ToggleSwitch/ToggleSwitch.svelte";
	import ManualEntryActions from "$lib/components/ingredients/manual-entry/ManualEntryActions/ManualEntryActions.svelte";
	import ManualEntryField from "$lib/components/ingredients/manual-entry/ManualEntryField/ManualEntryField.svelte";
	import ManualEntryHelper from "$lib/components/ingredients/manual-entry/ManualEntryHelper/ManualEntryHelper.svelte";
	import ManualEntryStepLayout from "$lib/components/ingredients/manual-entry/ManualEntryStepLayout/ManualEntryStepLayout.svelte";
	import ManualEntryToggleRow from "$lib/components/ingredients/manual-entry/ManualEntryToggleRow/ManualEntryToggleRow.svelte";
	import type { ServingsStepProps } from "./types";
	import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";

	let {
		servingLabel,
		resolvedServingLabel,
		servingWeightGrams,
		useVolumeEquivalent,
		volumeQuantity,
		volumeUnit,
		volumeOptions,
		onServingLabelChange,
		onServingWeightChange,
		onUseVolumeChange,
		onVolumeQuantityChange,
		onVolumeUnitChange,
		onBack,
		onNext,
	}: ServingsStepProps = $props();

	const servingWeightDisplay = $derived(
		Number.isFinite(servingWeightGrams) && (servingWeightGrams ?? 0) > 0
			? servingWeightGrams
			: "",
	);
	const servingWeightCopy = $derived(
		Number.isFinite(servingWeightGrams) && (servingWeightGrams ?? 0) > 0
			? `${servingWeightGrams}g`
			: "the entered gram weight",
	);
</script>

<ManualEntryStepLayout>
	<ManualEntryHelper>
		All nutrition values are stored per 100g. Serving sizes let users see scaled values.
	</ManualEntryHelper>

	<section class="servings-step__card" aria-label="Primary serving">
		<h3>Primary serving <em>*</em></h3>
		<ManualEntryField forId="custom-ingredient-serving-weight" label="Weight (g)" required>
			<input
				id="custom-ingredient-serving-weight"
				name="custom-ingredient-serving-weight"
				type="number"
				min="0.1"
				step="any"
				placeholder="e.g. 30"
				value={servingWeightDisplay}
				onfocus={(event) => event.currentTarget.select()}
				oninput={(event) => onServingWeightChange(event.currentTarget.valueAsNumber)}
			/>
		</ManualEntryField>

		<ManualEntryToggleRow
			title="Label includes volume"
			description="Use only when the package gives both volume and grams, like 1 tbsp = 20g."
		>
			<ToggleSwitch
				id="custom-ingredient-use-volume"
				name="custom-ingredient-use-volume"
				ariaLabel="Label includes volume"
				checked={useVolumeEquivalent}
				onChange={onUseVolumeChange}
			/>
		</ManualEntryToggleRow>

		{#if useVolumeEquivalent}
			<div class="servings-step__inline-grid">
				<ManualEntryField forId="custom-ingredient-volume-amount" label="Volume in this serving" required>
					<input
						id="custom-ingredient-volume-amount"
						name="custom-ingredient-volume-amount"
						type="number"
						min="0.1"
						step="any"
						placeholder="2"
						value={volumeQuantity ?? ""}
						onfocus={(event) => event.currentTarget.select()}
						oninput={(event) => onVolumeQuantityChange(Number.isFinite(event.currentTarget.valueAsNumber) ? event.currentTarget.valueAsNumber : null)}
					/>
				</ManualEntryField>

				<ManualEntryField forId="custom-ingredient-volume-unit" label="Volume unit">
					<select
						id="custom-ingredient-volume-unit"
						name="custom-ingredient-volume-unit"
						value={volumeUnit}
						onchange={(event) => onVolumeUnitChange(event.currentTarget.value as ServingMeasureUnit)}
					>
						{#each volumeOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</ManualEntryField>
			</div>
			<ManualEntryHelper>
				This records the entered volume as weighing
				<strong>{servingWeightCopy}</strong>. Turn off volume measurements if the package
				does not provide both values.
			</ManualEntryHelper>
		{/if}

		<details class="servings-step__optional-details">
			<summary>Optional display label</summary>
			<ManualEntryField forId="custom-ingredient-serving-label" label="Serving label" optional>
				<input
					id="custom-ingredient-serving-label"
					name="custom-ingredient-serving-label"
					type="text"
					placeholder="Optional, e.g. 1 bar, 3 cookies, 1 scoop"
					maxlength="80"
					value={servingLabel}
					oninput={(event) => onServingLabelChange(event.currentTarget.value)}
				/>
				<small>
					{servingLabel.trim()
						? "Shown anywhere this serving size is displayed."
						: `If left blank, this saves as “${resolvedServingLabel}”.`}
				</small>
			</ManualEntryField>
		</details>
	</section>

	<ManualEntryActions {onBack} {onNext} />
</ManualEntryStepLayout>

<style lang="scss">
	@use "./ServingsStep.scss";
</style>
