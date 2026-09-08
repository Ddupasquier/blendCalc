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
	const selectedServingMeasure = $derived(
		servingMeasureOptions.find(
			(option) => option.value === servingMeasureUnit,
		) ?? null,
	);
	const servingMeasureShortUnit = $derived.by(() => {
		const optionLabel = selectedServingMeasure?.label ?? servingMeasureUnit;
		return optionLabel.match(/\(([^)]+)\)/)?.[1] ?? optionLabel;
	});
	const hasServingWeight = $derived(
		Number.isFinite(servingWeightGrams) && (servingWeightGrams ?? 0) > 0,
	);
	const hasServingMeasure = $derived(
		useServingMeasure &&
			Number.isFinite(servingMeasureQuantity) &&
			(servingMeasureQuantity ?? 0) > 0 &&
			Boolean(selectedServingMeasure),
	);
	const automaticServingLabel = $derived(
		hasServingMeasure
			? `${servingMeasureQuantity} ${servingMeasureShortUnit}`
			: "",
	);
	const packageServingLabel = $derived(
		servingLabel.trim() || automaticServingLabel,
	);
	const labelIncludesGramWeight = (label: string, grams: number) => {
		const gramValues = [
			...label.matchAll(/(\d+(?:\.\d+)?)\s*(?:g|grams?)(?=$|[\s)])/gi),
		];
		return gramValues.some((match) => {
			const value = Number(match[1]);
			return Number.isFinite(value) && Math.abs(value - grams) < 0.001;
		});
	};
	const servingSummary = $derived.by(() => {
		const weight = hasServingWeight ? `${servingWeightGrams}g` : "";
		const labelAlreadyIncludesWeight =
			hasServingWeight &&
			labelIncludesGramWeight(packageServingLabel, servingWeightGrams!);
		const savedServing =
			packageServingLabel && weight && !labelAlreadyIncludesWeight
				? `${packageServingLabel} (${weight})`
				: packageServingLabel || weight;

		if (packageServingLabel && weight) {
			if (servingLabel.trim() && automaticServingLabel) {
				return `BlendCalc will save one serving as ${savedServing}, with an exact measure of ${automaticServingLabel}.`;
			}
			return `BlendCalc will save one serving as ${savedServing}.`;
		}
		if (packageServingLabel) {
			return `BlendCalc will save one serving as ${packageServingLabel}. Nutrition will stay on this package measure because no gram weight was entered.`;
		}
		if (weight) {
			return `BlendCalc will save one serving as ${weight}.`;
		}
		return "Enter the serving's gram weight, or add the volume or item amount printed on the package.";
	});
</script>

<ManualEntryStepLayout>
	<ManualEntryHelpText>
		Copy one serving from the package. Only enter a weight or measure when it is
		printed on the label.
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

	<section class="servings-step__card" aria-labelledby="package-serving-title">
		<div class="servings-step__heading">
			<h3 id="package-serving-title">
				Serving shown on package {#if requiresServingMeasurement}<em>*</em>{/if}
			</h3>
			<p>Enter the parts printed together for one serving.</p>
		</div>
		{#if usesInternal100GramBasis}
			<StatusMessage
				title="No package serving was reported"
				message="You can leave this blank. Source nutrition stays on an internal per-100g basis until an exact gram serving is available; blendCalc will not invent one."
			/>
		{/if}
		<ManualEntryField
			forId="custom-ingredient-serving-weight"
			label="Gram weight (g)"
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
			<small>If the package says “2 tbsp (32g),” enter 32.</small>
		</ManualEntryField>

		<ManualEntryToggleRow
			title="Volume or item amount"
			description="Turn on if this same serving is also listed as tbsp, mL, cups, pieces, or another unit."
		>
			<ToggleSwitch
				id="custom-ingredient-use-serving-measure"
				name="custom-ingredient-use-serving-measure"
				ariaLabel="Volume or item amount"
				checked={useServingMeasure}
				onChange={onUseServingMeasureChange}
			/>
		</ManualEntryToggleRow>

		{#if useServingMeasure}
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
			<TextField
				id="custom-ingredient-serving-label"
				name="custom-ingredient-serving-label"
				label="Package wording (optional)"
				value={servingLabel}
				placeholder="e.g. 1 scoop"
				helper={hasServingMeasure
					? `Leave blank to use “${automaticServingLabel}.” Only enter different wording printed on the package.`
					: "Complete Amount and Unit first. Leave this blank unless the package uses different wording."}
				oninput={(event) => onServingLabelChange(event.currentTarget.value)}
			/>
		{/if}

		<p class="servings-step__summary" aria-live="polite" aria-atomic="true">
			{servingSummary}
		</p>
	</section>

	<ManualEntryActions {onBack} {onNext} />
</ManualEntryStepLayout>

<style lang="scss">
	@use "./ServingsStep.scss";
</style>
