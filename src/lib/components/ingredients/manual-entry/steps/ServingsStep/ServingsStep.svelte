<script lang="ts">
	import ToggleSwitch from "$lib/components/common/forms/ToggleSwitch/ToggleSwitch.svelte";
	import NumberInput from "$lib/components/common/forms/NumberInput/NumberInput.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import ManualEntryActions from "$lib/components/ingredients/manual-entry/ManualEntryActions/ManualEntryActions.svelte";
	import ManualEntryField from "$lib/components/ingredients/manual-entry/ManualEntryField/ManualEntryField.svelte";
	import ManualEntryHelpText from "$lib/components/ingredients/manual-entry/ManualEntryHelpText/ManualEntryHelpText.svelte";
	import ManualEntryStepLayout from "$lib/components/ingredients/manual-entry/ManualEntryStepLayout/ManualEntryStepLayout.svelte";
	import ManualEntryToggleRow from "$lib/components/ingredients/manual-entry/ManualEntryToggleRow/ManualEntryToggleRow.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import type { ServingsStepProps } from "./types";
	import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";

	let {
		servingWeightGrams,
		usesInternal100GramBasis,
		requiresServingWeight,
		useVolumeEquivalent,
		volumeQuantity,
		volumeUnit,
		volumeOptions,
		regulatoryDisclosureProfiles,
		regulatoryDisclosureProfileError,
		regulatoryDisclosureProfileKey,
		alcoholByVolumePercent,
		requiresAlcoholByVolume,
		onServingWeightChange,
		onUseVolumeChange,
		onVolumeQuantityChange,
		onVolumeUnitChange,
		onRegulatoryDisclosureChange,
		onAlcoholByVolumeChange,
		onBack,
		onNext,
	}: ServingsStepProps = $props();

	const servingWeightDisplay = $derived(
		!usesInternal100GramBasis &&
		Number.isFinite(servingWeightGrams) &&
		(servingWeightGrams ?? 0) > 0
			? servingWeightGrams
			: "",
	);
	const servingWeightCopy = $derived(
		Number.isFinite(servingWeightGrams) && (servingWeightGrams ?? 0) > 0
			? `${servingWeightGrams}g`
			: "the entered gram weight",
	);
	const regulatoryDisclosureOptions = $derived([
		{
			value: "",
			label: "No label context selected",
			placeholder: true,
		},
		...regulatoryDisclosureProfiles.map((profile) => ({
			value: profile.key,
			label: profile.displayName,
		})),
	]);
	const selectedDisclosureProfile = $derived(
		regulatoryDisclosureProfiles.find(
			(profile) => profile.key === regulatoryDisclosureProfileKey,
		) ?? null,
	);
</script>

<ManualEntryStepLayout>
	<ManualEntryHelpText>
		All nutrition values are stored per 100g. Serving sizes let users see scaled values.
	</ManualEntryHelpText>

	<section class="servings-step__card" aria-labelledby="package-label-context-title">
		<div class="servings-step__heading">
			<h3 id="package-label-context-title">Package label context</h3>
			<p>
				Choose the label format before entering nutrition. This keeps legally omitted
				values unknown instead of treating them as zero.
			</p>
		</div>
		<ManualEntryField forId="custom-ingredient-label-context" label="Label format" optional>
			<SelectField
				id="custom-ingredient-label-context"
				name="custom-ingredient-label-context"
				value={regulatoryDisclosureProfileKey}
				options={regulatoryDisclosureOptions}
				onValueChange={onRegulatoryDisclosureChange}
			/>
			{#if selectedDisclosureProfile}
				<small>{selectedDisclosureProfile.userDescription}</small>
			{:else if regulatoryDisclosureProfileError}
				<small>{regulatoryDisclosureProfileError}</small>
			{/if}
		</ManualEntryField>
		{#if alcoholByVolumePercent !== null || requiresAlcoholByVolume}
			<ManualEntryField
				forId="custom-ingredient-alcohol-by-volume"
				label="Alcohol by volume (%)"
				optional={!requiresAlcoholByVolume}
				required={requiresAlcoholByVolume}
			>
				<NumberInput
					id="custom-ingredient-alcohol-by-volume"
					name="custom-ingredient-alcohol-by-volume"
					value={alcoholByVolumePercent}
					min={0}
					max={100}
					step="0.1"
					placeholder="ABV shown on the package"
					required={requiresAlcoholByVolume}
					onValueChange={(_value, percent) => onAlcoholByVolumeChange(percent)}
				/>
				<small>Enter the package's volume percentage. This is not alcohol grams.</small>
			</ManualEntryField>
		{/if}
	</section>

	<section class="servings-step__card" aria-label="Primary serving">
		<h3>Primary serving {#if requiresServingWeight}<em>*</em>{/if}</h3>
		{#if usesInternal100GramBasis}
			<StatusMessage
				title="No package serving was reported"
				message="You can leave this blank. Source nutrition stays on an internal per-100g basis until an exact gram serving is available; blendCalc will not invent one."
			/>
		{/if}
		<ManualEntryField
			forId="custom-ingredient-serving-weight"
			label="Weight (g)"
			optional={!requiresServingWeight}
			required={requiresServingWeight}
		>
			<NumberInput
				id="custom-ingredient-serving-weight"
				name="custom-ingredient-serving-weight"
				min="0.1"
				step="any"
				placeholder="e.g. 30"
				required={requiresServingWeight}
				value={servingWeightDisplay}
				onValueChange={(_, valueAsNumber) => onServingWeightChange(valueAsNumber ?? Number.NaN)}
			/>
			{#if !requiresServingWeight}
				<small>Add a gram weight only when it is printed on the package.</small>
			{/if}
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
					<NumberInput
						id="custom-ingredient-volume-amount"
						name="custom-ingredient-volume-amount"
						min="0.1"
						step="any"
						placeholder="2"
						value={volumeQuantity ?? ""}
						onValueChange={(_, valueAsNumber) => onVolumeQuantityChange(valueAsNumber)}
					/>
				</ManualEntryField>

				<ManualEntryField forId="custom-ingredient-volume-unit" label="Volume unit">
					<SelectField
						id="custom-ingredient-volume-unit"
						name="custom-ingredient-volume-unit"
						value={volumeUnit}
						options={volumeOptions}
						onValueChange={(value) => onVolumeUnitChange(value as ServingMeasureUnit)}
					/>
				</ManualEntryField>
			</div>
			<ManualEntryHelpText>
				This records the entered volume as weighing
				<strong>{servingWeightCopy}</strong>. Turn off volume measurements if the package
				does not provide both values.
			</ManualEntryHelpText>
		{/if}
	</section>

	<ManualEntryActions {onBack} {onNext} />
</ManualEntryStepLayout>

<style lang="scss">
	@use "./ServingsStep.scss";
</style>
