<script lang="ts">
	import ToggleSwitch from "$lib/components/common/ToggleSwitch.svelte";
	import type { ServingMeasureUnit } from "../../../../../defaults/servingMeasureDefaults";

	type VolumeOption = {
		value: ServingMeasureUnit;
		label: string;
	};

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
	}: {
		servingLabel: string;
		resolvedServingLabel: string;
		servingWeightGrams: number;
		useVolumeEquivalent: boolean;
		volumeQuantity: number | null;
		volumeUnit: ServingMeasureUnit;
		volumeOptions: VolumeOption[];
		onServingLabelChange: (value: string) => void;
		onServingWeightChange: (value: number) => void;
		onUseVolumeChange: (value: boolean) => void;
		onVolumeQuantityChange: (value: number | null) => void;
		onVolumeUnitChange: (value: ServingMeasureUnit) => void;
		onBack: () => void;
		onNext: () => void;
	} = $props();
</script>

<div class="custom-ingredient__step">
	<p class="custom-ingredient__helper">
		All nutrition values are stored per 100g. Serving sizes let users see scaled values.
	</p>

	<section class="custom-ingredient__card" aria-label="Primary serving">
		<h3>Primary serving <em>*</em></h3>
		<label class="custom-ingredient__field">
			<span>Weight (g) <em>*</em></span>
			<input
				id="custom-ingredient-serving-weight"
				name="custom-ingredient-serving-weight"
				type="number"
				min="0.1"
				step="any"
				placeholder="e.g. 240"
				value={servingWeightGrams}
				oninput={(event) => onServingWeightChange(event.currentTarget.valueAsNumber)}
			/>
		</label>

		<label class="custom-ingredient__switch">
			<span>
				<strong>Label includes volume</strong>
				<small>Use only when the package gives both volume and grams, like 1 tbsp = 20g.</small>
			</span>
			<ToggleSwitch
				id="custom-ingredient-use-volume"
				name="custom-ingredient-use-volume"
				ariaLabel="Label includes volume"
				checked={useVolumeEquivalent}
				onChange={onUseVolumeChange}
			/>
		</label>

		{#if useVolumeEquivalent}
			<div class="custom-ingredient__inline-grid">
				<label class="custom-ingredient__field">
					<span>Volume in this serving <em>*</em></span>
					<input
						id="custom-ingredient-volume-amount"
						name="custom-ingredient-volume-amount"
						type="number"
						min="0.1"
						step="any"
						placeholder="2"
						value={volumeQuantity ?? ""}
						oninput={(event) => onVolumeQuantityChange(Number.isFinite(event.currentTarget.valueAsNumber) ? event.currentTarget.valueAsNumber : null)}
					/>
				</label>

				<label class="custom-ingredient__field">
					<span>Volume unit</span>
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
				</label>
			</div>
			<p class="custom-ingredient__helper">
				This records the entered volume as weighing
				<strong>{servingWeightGrams}g</strong>. Turn off volume measurements if the package
				does not provide both values.
			</p>
		{/if}

		<details class="custom-ingredient__optional-details">
			<summary>Optional display label</summary>
			<label class="custom-ingredient__field">
				<span>Serving label <small>optional</small></span>
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
			</label>
		</details>
	</section>

	<button type="button" class="custom-ingredient__add-serving">
		+ Add another serving size
	</button>

	<div class="custom-ingredient__actions">
		<button type="button" class="custom-ingredient__secondary" onclick={onBack}>
			Back
		</button>
		<button type="button" class="custom-ingredient__primary" onclick={onNext}>
			Continue
		</button>
	</div>
</div>
