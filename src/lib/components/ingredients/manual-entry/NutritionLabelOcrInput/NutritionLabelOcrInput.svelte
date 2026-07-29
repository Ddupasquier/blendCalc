<script lang="ts">
	import { onDestroy } from "svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import CheckboxGroup from "$lib/components/common/forms/CheckboxGroup/CheckboxGroup.svelte";
	import PhotoUploadInput from "$lib/components/common/forms/PhotoUploadInput/PhotoUploadInput.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import { animatedDetails } from "$lib/utils/accessibility/animatedDetails";
	import type { NutritionLabelOcrInputProps } from "./types";
	import { recognizeNutritionLabelImage } from "$lib/utils/food/ocr/nutritionLabelOcr.client";
	import {
		parseNutritionLabelText,
		type NutritionLabelOcrResult,
	} from "$lib/utils/food/ocr/nutritionLabelOcr";

	let {
		mappings,
		photo,
		recognize = recognizeNutritionLabelImage,
		onPhotoChange,
		onApply,
	}: NutritionLabelOcrInputProps = $props();

	let scanning = $state(false);
	let progress = $state(0);
	let progressStatus = $state("");
	let result = $state<NutritionLabelOcrResult | null>(null);
	let selected = $state<(string | number)[]>([]);
	let error = $state("");
	let appliedMessage = $state("");
	let abortController = $state<AbortController | null>(null);

	const servingOptionId = "serving";
	const formatValue = (value: number) =>
		new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
	const options = $derived([
		...(result?.serving
			? [
					{
						id: servingOptionId,
						label: `Serving: ${result.serving.label} · ${formatValue(result.serving.gramWeight)}g`,
					},
				]
			: []),
		...(result?.candidates.map((candidate) => ({
			id: candidate.nutrientId,
			label: `${candidate.nutrientName}: ${formatValue(candidate.value)} ${candidate.unitName.toLowerCase()}`,
		})) ?? []),
	]);

	const clearScan = () => {
		abortController?.abort();
		abortController = null;
		result = null;
		selected = [];
		error = "";
		appliedMessage = "";
		progress = 0;
		progressStatus = "";
	};

	const handlePhotoChange = (file: File | null) => {
		clearScan();
		onPhotoChange(file);
	};

	const scanPhoto = async () => {
		if (!photo || scanning || mappings.length === 0) return;
		clearScan();
		scanning = true;
		abortController = new AbortController();
		try {
			const recognition = await recognize({
				file: photo,
				signal: abortController.signal,
				onProgress: (nextProgress) => {
					progress = nextProgress.progress;
					progressStatus = nextProgress.status;
				},
			});
			result = parseNutritionLabelText({
				text: recognition.text,
				confidence: recognition.confidence,
				mappings,
			});
			selected = [
				...(result.serving ? [servingOptionId] : []),
				...result.candidates.map((candidate) => candidate.nutrientId),
			];
			if (selected.length === 0) {
				error = "No safe nutrition values were found. Enter the label values manually.";
			}
		} catch (scanError) {
			if (!(scanError instanceof DOMException && scanError.name === "AbortError")) {
				error = "The label could not be read. Try a clearer, straight-on photo or enter the values manually.";
			}
		} finally {
			scanning = false;
			abortController = null;
		}
	};

	const applySelected = () => {
		if (!result) return;
		const selectedNutrientIds = new Set(
			selected.filter((value): value is number => typeof value === "number"),
		);
		onApply({
			candidates: result.candidates.filter((candidate) =>
				selectedNutrientIds.has(candidate.nutrientId),
			),
			serving: selected.includes(servingOptionId) ? result.serving : null,
		});
		appliedMessage = "Selected label values were added. Review them before continuing.";
	};

	onDestroy(() => {
		abortController?.abort();
	});
</script>

<section class="nutrition-label-ocr" aria-labelledby="nutrition-label-ocr-title">
	<div class="nutrition-label-ocr__heading">
		<strong id="nutrition-label-ocr-title">Scan nutrition label</strong>
		<span>optional</span>
	</div>
	<PhotoUploadInput
		id="custom-ingredient-label-ocr-photo"
		name="custom-ingredient-label-ocr-photo"
		prompt="Nutrition facts photo"
		description="Use a clear label photo to suggest values. Nothing is added until you review and confirm it."
		photoCount={1}
		files={photo ? [photo] : []}
		capture="environment"
		onFilesChange={(files) => handlePhotoChange(files[0] ?? null)}
	/>

	<RoundedActionButton
		onclick={scanPhoto}
		busy={scanning}
		disabled={!photo || mappings.length === 0}
	>
		Read label
	</RoundedActionButton>

	{#if scanning}
		<div class="nutrition-label-ocr__progress" aria-live="polite">
			<progress max="1" value={progress}></progress>
			<span>{progressStatus || "Preparing label scan…"}</span>
		</div>
	{/if}

	{#if result && options.length > 0}
		<fieldset class="nutrition-label-ocr__review">
			<legend>Review suggestions</legend>
			<p>Uncheck anything that does not match the package label.</p>
			<CheckboxGroup {options} {selected} onChange={(values) => (selected = values)} />
		</fieldset>
		<RoundedActionButton onclick={applySelected} disabled={selected.length === 0}>
			Use selected values
		</RoundedActionButton>
		<details class="nutrition-label-ocr__raw-text" use:animatedDetails>
			<summary>View recognized text</summary>
			<pre>{result.rawText}</pre>
		</details>
	{/if}

	{#if error}
		<StatusMessage tone="danger" title="Label scan needs attention">{error}</StatusMessage>
	{/if}
	{#if appliedMessage}
		<StatusMessage tone="success" title="Suggestions applied">{appliedMessage}</StatusMessage>
	{/if}
</section>

<style lang="scss">
	@use "./NutritionLabelOcrInput.scss";
</style>
