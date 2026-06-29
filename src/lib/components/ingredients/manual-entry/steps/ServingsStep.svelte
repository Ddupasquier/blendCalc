<script lang="ts">
	import type { ServingMeasureUnit } from "../../../../../defaults/servingMeasureDefaults";

	type VolumeOption = {
		value: ServingMeasureUnit;
		label: string;
	};

	let {
		servingLabel,
		servingWeightGrams,
		useVolumeEquivalent,
		volumeQuantity,
		volumeUnit,
		volumeOptions,
		onServingLabelChange,
		onServingWeightChange,
		onVolumeQuantityChange,
		onVolumeUnitChange,
		onBack,
		onNext,
	}: {
		servingLabel: string;
		servingWeightGrams: number;
		useVolumeEquivalent: boolean;
		volumeQuantity: number | null;
		volumeUnit: ServingMeasureUnit;
		volumeOptions: VolumeOption[];
		onServingLabelChange: (value: string) => void;
		onServingWeightChange: (value: number) => void;
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
			<span>Description <em>*</em></span>
			<input
				id="custom-ingredient-serving-label"
				name="custom-ingredient-serving-label"
				type="text"
				placeholder="e.g. 1 cup, 1 bar, 2 tbsp"
				maxlength="80"
				value={servingLabel}
				oninput={(event) => onServingLabelChange(event.currentTarget.value)}
			/>
		</label>
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

		{#if useVolumeEquivalent}
			<div class="custom-ingredient__inline-grid">
				<label class="custom-ingredient__field">
					<span>Volume in this serving</span>
					<input
						id="custom-ingredient-volume-amount"
						name="custom-ingredient-volume-amount"
						type="number"
						min="0"
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
				<strong>{servingWeightGrams}g</strong>. Leave it off if the package does not provide both values.
			</p>
		{/if}
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
