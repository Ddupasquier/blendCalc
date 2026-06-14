<script lang="ts">
	import {
		SERVING_MEASURE_OPTIONS,
		type ServingMeasureUnit,
	} from "../../../defaults/servingMeasureDefaults";
	import {
		createCustomFood,
		saveCustomFood,
		type CustomFoodNutritionInput,
	} from "$lib/utils/food/customFoods";
	import type { FdcFood } from "$lib/utils/food/types";

	let {
		onCreate,
	}: {
		onCreate: (food: FdcFood) => void;
	} = $props();

	const volumeOptions = SERVING_MEASURE_OPTIONS.filter(
		(option) => option.dimension === "volume",
	);

	let name = $state("");
	let servingLabel = $state("");
	let servingWeightGrams = $state(30);
	let volumeQuantity = $state<number | null>(null);
	let volumeUnit = $state<ServingMeasureUnit>("tbsp");
	let error = $state("");
	let savedMessage = $state("");

	let nutrition = $state<CustomFoodNutritionInput>({
		calories: 0,
		fat: 0,
		carbs: 0,
		fiber: 0,
		sugar: 0,
		protein: 0,
	});

	const setNutritionValue = (
		key: keyof CustomFoodNutritionInput,
		value: string,
	) => {
		const numericValue = Number(value);
		nutrition = {
			...nutrition,
			[key]: Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0,
		};
	};

	const resetForm = () => {
		name = "";
		servingLabel = "";
		servingWeightGrams = 30;
		volumeQuantity = null;
		volumeUnit = "tbsp";
		nutrition = {
			calories: 0,
			fat: 0,
			carbs: 0,
			fiber: 0,
			sugar: 0,
			protein: 0,
		};
	};

	const handleSubmit = () => {
		error = "";
		savedMessage = "";

		if (!name.trim()) {
			error = "Add a name for this ingredient.";
			return;
		}

		if (!Number.isFinite(servingWeightGrams) || servingWeightGrams <= 0) {
			error = "Serving weight must be greater than 0g.";
			return;
		}

		if (volumeQuantity !== null && volumeQuantity <= 0) {
			error = "Volume equivalent must be greater than 0 or left blank.";
			return;
		}

		const food = createCustomFood({
			name,
			servingLabel,
			servingWeightGrams,
			volumeQuantity: volumeQuantity ?? undefined,
			volumeUnit: volumeQuantity ? volumeUnit : undefined,
			nutrition,
		});

		saveCustomFood(food);
		onCreate(food);
		savedMessage = `${food.description} saved as a custom ingredient.`;
		resetForm();
	};
</script>

<details class="custom-ingredient">
	<summary>
		<span>Add custom ingredient</span>
		<small>Use this when the app does not have the food you need.</small>
	</summary>

	<div class="custom-ingredient__body">
		<div class="custom-ingredient__grid">
			<label class="custom-ingredient__wide">
				<span>Ingredient name</span>
				<input
					id="custom-ingredient-name"
					name="custom-ingredient-name"
					type="text"
					placeholder="Oreos, homemade smoothie base..."
					bind:value={name}
				/>
			</label>

			<label>
				<span>Serving label</span>
				<input
					id="custom-ingredient-serving-label"
					name="custom-ingredient-serving-label"
					type="text"
					placeholder="3 cookies, 1 scoop..."
					bind:value={servingLabel}
				/>
			</label>

			<label>
				<span>Serving weight</span>
				<div class="custom-ingredient__inline-input">
					<input
						id="custom-ingredient-serving-weight"
						name="custom-ingredient-serving-weight"
						type="number"
						min="0.1"
						step="any"
						bind:value={servingWeightGrams}
					/>
					<em>g</em>
				</div>
			</label>
		</div>

		<section class="custom-ingredient__volume">
			<div>
				<strong>Optional volume equivalent</strong>
				<p>
					Add this if you want cups, tbsp, tsp, ml, or fl oz to convert using
					your exact ingredient density.
				</p>
			</div>
			<div class="custom-ingredient__grid">
				<label>
					<span>Volume amount</span>
					<input
						id="custom-ingredient-volume-amount"
						name="custom-ingredient-volume-amount"
						type="number"
						min="0"
						step="any"
						placeholder="2"
						bind:value={volumeQuantity}
					/>
				</label>

				<label>
					<span>Volume unit</span>
					<select
						id="custom-ingredient-volume-unit"
						name="custom-ingredient-volume-unit"
						bind:value={volumeUnit}
					>
						{#each volumeOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>
			</div>
		</section>

		<section class="custom-ingredient__nutrition">
			<div>
				<strong>Nutrition facts per serving</strong>
				<p>
					Enter the numbers from the label for the serving above. The app
					converts them to per-100g data automatically.
				</p>
			</div>

			<div class="custom-ingredient__nutrition-grid">
				<label>
					<span>Calories</span>
					<input
						id="custom-ingredient-calories"
						name="custom-ingredient-calories"
						type="number"
						min="0"
						step="any"
						value={nutrition.calories}
						oninput={(event) =>
							setNutritionValue("calories", event.currentTarget.value)}
					/>
				</label>
				<label>
					<span>Total Fat (g)</span>
					<input
						id="custom-ingredient-fat"
						name="custom-ingredient-fat"
						type="number"
						min="0"
						step="any"
						value={nutrition.fat}
						oninput={(event) =>
							setNutritionValue("fat", event.currentTarget.value)}
					/>
				</label>
				<label>
					<span>Total Carb. (g)</span>
					<input
						id="custom-ingredient-carbs"
						name="custom-ingredient-carbs"
						type="number"
						min="0"
						step="any"
						value={nutrition.carbs}
						oninput={(event) =>
							setNutritionValue("carbs", event.currentTarget.value)}
					/>
				</label>
				<label>
					<span>Dietary Fiber (g)</span>
					<input
						id="custom-ingredient-fiber"
						name="custom-ingredient-fiber"
						type="number"
						min="0"
						step="any"
						value={nutrition.fiber}
						oninput={(event) =>
							setNutritionValue("fiber", event.currentTarget.value)}
					/>
				</label>
				<label>
					<span>Total Sugars (g)</span>
					<input
						id="custom-ingredient-sugar"
						name="custom-ingredient-sugar"
						type="number"
						min="0"
						step="any"
						value={nutrition.sugar}
						oninput={(event) =>
							setNutritionValue("sugar", event.currentTarget.value)}
					/>
				</label>
				<label>
					<span>Protein (g)</span>
					<input
						id="custom-ingredient-protein"
						name="custom-ingredient-protein"
						type="number"
						min="0"
						step="any"
						value={nutrition.protein}
						oninput={(event) =>
							setNutritionValue("protein", event.currentTarget.value)}
					/>
				</label>
			</div>
		</section>

		{#if error}
			<p class="custom-ingredient__error" role="alert">{error}</p>
		{/if}
		{#if savedMessage}
			<p class="custom-ingredient__success" role="status">{savedMessage}</p>
		{/if}

		<button type="button" onclick={handleSubmit}>Save custom ingredient</button>
	</div>
</details>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.custom-ingredient {
		padding: $app-gap-sm;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-card-radius;
	}

	summary {
		display: grid;
		gap: 0.1rem;
		color: $app-primary;
		cursor: pointer;
		font-weight: 800;
		list-style-position: inside;

		small {
			color: $app-muted;
			font-size: 0.78rem;
			font-weight: 600;
		}
	}

	.custom-ingredient__body {
		display: grid;
		gap: $app-gap-md;
		margin-top: $app-gap-md;
	}

	.custom-ingredient__grid,
	.custom-ingredient__nutrition-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: $app-gap-sm;
	}

	.custom-ingredient__wide {
		grid-column: 1 / -1;
	}

	label {
		display: grid;
		gap: 0.22rem;
		min-width: 0;
		color: $app-muted;
		font-size: 0.76rem;
		font-weight: 800;
	}

	input,
	select {
		width: 100%;
		min-width: 0;
		padding: 0.5rem 0.6rem;
		color: $app-primary;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-radius;
	}

	.custom-ingredient__inline-input {
		display: flex;
		align-items: center;
		gap: 0.35rem;

		em {
			color: $app-muted;
			font-style: normal;
			font-weight: 800;
		}
	}

	.custom-ingredient__volume,
	.custom-ingredient__nutrition {
		display: grid;
		gap: $app-gap-sm;
		padding-top: $app-gap-sm;
		border-top: $app-border;

		strong {
			color: $app-primary;
			font-size: 0.86rem;
		}

		p {
			color: $app-muted;
			font-size: 0.8rem;
			line-height: 1.35;
		}
	}

	.custom-ingredient__error,
	.custom-ingredient__success {
		font-size: 0.84rem;
		font-weight: 800;
	}

	.custom-ingredient__error {
		color: $app-warning-strong;
	}

	.custom-ingredient__success {
		color: $app-primary;
	}

	button {
		justify-self: end;
		width: fit-content;
		padding: 0.55rem 0.9rem;
		color: $app-btn-text;
		background: $app-btn-bg;
		border-radius: $app-radius-pill;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;

		&:hover {
			background: $app-btn-bg-hover;
		}
	}

	@media (max-width: $app-breakpoint-sm) {
		.custom-ingredient__grid,
		.custom-ingredient__nutrition-grid {
			grid-template-columns: 1fr;
		}

		button {
			width: 100%;
		}
	}
</style>
