<script lang="ts">
	import ToggleSwitch from "$lib/components/common/forms/ToggleSwitch/ToggleSwitch.svelte";
	import NumberInput from "$lib/components/common/forms/NumberInput/NumberInput.svelte";
	import SelectField from "$lib/components/common/forms/SelectField/SelectField.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
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
		requiresServingMeasurement,
		useServingMeasure,
		servingLabel,
		servingMeasureQuantity,
		servingMeasureUnit,
		servingMeasureOptions,
		regulatoryDisclosureProfiles,
		regulatoryDisclosureProfileError,
		regulatoryDisclosureProfileKey,
		alcoholByVolumePercent,
		requiresAlcoholByVolume,
		onServingWeightChange,
		onServingLabelChange,
		onUseServingMeasureChange,
		onServingMeasureQuantityChange,
		onServingMeasureUnitChange,
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
		Enter the serving exactly as the package reports it. Weight, volume, and
		item servings stay on their real basis unless the label provides an exact
		conversion.
	</ManualEntryHelpText>

	<section
		class="servings-step__card"
		aria-labelledby="package-label-context-title"
	>
		<div class="servings-step__heading">
			<h3 id="package-label-context-title">Package label context</h3>
			<p>
				Choose the label format before entering nutrition. This keeps legally
				omitted values unknown instead of treating them as zero.
			</p>
		</div>
		<ManualEntryField
			forId="custom-ingredient-label-context"
			label="Label format"
			optional
		>
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
				<small
					>Enter the package's volume percentage. This is not alcohol grams.</small
				>
			</ManualEntryField>
		{/if}
	</section>

	<section class="servings-step__card" aria-label="Primary serving">
		<h3>
			Primary serving {#if requiresServingMeasurement}<em>*</em>{/if}
		</h3>
		{#if usesInternal100GramBasis}
			<StatusMessage
				title="No package serving was reported"
				message="You can leave this blank. Source nutrition stays on an internal per-100g basis until an exact gram serving is available; blendCalc will not invent one."
			/>
		{/if}
		<ManualEntryField
			forId="custom-ingredient-serving-weight"
			label="Weight (g)"
			optional
		>
			<NumberInput
				id="custom-ingredient-serving-weight"
				name="custom-ingredient-serving-weight"
				min="0.1"
				step="any"
				placeholder="e.g. 30"
				required={false}
				value={servingWeightDisplay}
				onValueChange={(_, valueAsNumber) =>
					onServingWeightChange(valueAsNumber ?? Number.NaN)}
			/>
			<small>Add a gram weight only when it is printed on the package.</small>
		</ManualEntryField>

		<ManualEntryToggleRow
			title="Package measure"
			description="Use for volume or item servings such as 1 tbsp, 240 mL, or 1 cookie."
		>
			<ToggleSwitch
				id="custom-ingredient-use-serving-measure"
				name="custom-ingredient-use-serving-measure"
				ariaLabel="Package measure"
				checked={useServingMeasure}
				onChange={onUseServingMeasureChange}
			/>
		</ManualEntryToggleRow>

		{#if useServingMeasure}
			<TextField
				id="custom-ingredient-serving-label"
				name="custom-ingredient-serving-label"
				label="Serving label"
				value={servingLabel}
				placeholder="e.g. 1 cookie or 2 tbsp"
				helper="Use the package wording when it is more specific than the unit."
				oninput={(event) => onServingLabelChange(event.currentTarget.value)}
			/>
			<div class="servings-step__inline-grid">
				<ManualEntryField
					forId="custom-ingredient-serving-measure-amount"
					label="Amount"
					required
				>
					<NumberInput
						id="custom-ingredient-serving-measure-amount"
						name="custom-ingredient-serving-measure-amount"
						min="0.1"
						step="any"
						placeholder="2"
						value={servingMeasureQuantity ?? ""}
						onValueChange={(_, valueAsNumber) =>
							onServingMeasureQuantityChange(valueAsNumber)}
					/>
				</ManualEntryField>

				<ManualEntryField
					forId="custom-ingredient-serving-measure-unit"
					label="Unit"
				>
					<SelectField
						id="custom-ingredient-serving-measure-unit"
						name="custom-ingredient-serving-measure-unit"
						value={servingMeasureUnit}
						options={servingMeasureOptions}
						onValueChange={(value) =>
							onServingMeasureUnitChange(value as ServingMeasureUnit)}
					/>
				</ManualEntryField>
			</div>
			<ManualEntryHelpText>
				If the package also gives grams, blendCalc can convert between the two
				exactly. Without grams, nutrition stays on this package measure instead
				of being guessed.
			</ManualEntryHelpText>
		{/if}
	</section>

	<ManualEntryActions {onBack} {onNext} />
</ManualEntryStepLayout>

<style lang="scss">
	@use "./ServingsStep.scss";
</style>
