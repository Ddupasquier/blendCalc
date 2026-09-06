<script lang="ts">
	import { onDestroy } from "svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import CheckboxGroup from "$lib/components/common/forms/CheckboxGroup/CheckboxGroup.svelte";
	import PhotoUploadInput from "$lib/components/common/forms/PhotoUploadInput/PhotoUploadInput.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import type { NutritionLabelOcrInputProps } from "./types";
	import type { NutritionLabelCrop } from "$lib/utils/food/ocr/nutritionLabelOcr.client";
	import {
		cancelNutritionLabelOcrJob,
		runNutritionLabelOcrJob,
	} from "$lib/utils/food/ocr/nutritionLabelOcrJobs.client";
	import type {
		NutritionLabelOcrJobResult,
		NutritionLabelOcrJobStatus,
	} from "$lib/utils/food/ocr/nutritionLabelOcrJobs";

	let {
		mappings,
		photo,
		runJob = runNutritionLabelOcrJob,
		onPhotoChange,
		onApply,
	}: NutritionLabelOcrInputProps = $props();

	let scanning = $state(false);
	let uploadProgress = $state<number | null>(null);
	let progressStatus = $state("");
	let result = $state<NutritionLabelOcrJobResult | null>(null);
	let selected = $state<(string | number)[]>([]);
	let error = $state("");
	let appliedMessage = $state("");
	let abortController = $state<AbortController | null>(null);
	let previewUrl = $state("");
	let cropLeft = $state(0);
	let cropTop = $state(0);
	let cropRight = $state(100);
	let cropBottom = $state(100);
	const crop = $derived<NutritionLabelCrop>({
		left: cropLeft / 100,
		top: cropTop / 100,
		right: cropRight / 100,
		bottom: cropBottom / 100,
	});
	let activeJobId = $state("");

	const servingOptionId = "serving";
	const qualitativeOptionId = (nutrientId: number) =>
		`qualitative:${nutrientId}`;
	const formatValue = (value: number) =>
		new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(
			value,
		);
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
		...(result?.qualitativeFacts.map((fact) => ({
			id: qualitativeOptionId(fact.nutrientId),
			label: `${fact.nutrientName}: ${fact.maximumAmount === undefined ? "Not a significant source" : `<${formatValue(fact.maximumAmount)} ${fact.unitName.toLowerCase()}`}`,
		})) ?? []),
	]);

	const clearScan = ({ cancelJob = false } = {}) => {
		abortController?.abort();
		abortController = null;
		if (cancelJob && activeJobId) {
			void cancelNutritionLabelOcrJob(activeJobId).catch(() => undefined);
		}
		activeJobId = "";
		result = null;
		selected = [];
		error = "";
		appliedMessage = "";
		uploadProgress = null;
		progressStatus = "";
	};

	const handlePhotoChange = (file: File | null) => {
		clearScan({ cancelJob: true });
		cropLeft = 0;
		cropTop = 0;
		cropRight = 100;
		cropBottom = 100;
		onPhotoChange(file);
	};

	const readStatus = (status: NutritionLabelOcrJobStatus) => {
		if (status === "queued" || status === "running") uploadProgress = null;
		progressStatus =
			status === "queued"
				? "Waiting for the background label reader…"
				: status === "running"
					? "Reading the label in the background…"
					: progressStatus;
	};

	const stopScan = () => {
		const jobId = activeJobId;
		abortController?.abort(
			new DOMException("Label scan cancelled", "AbortError"),
		);
		if (jobId) void cancelNutritionLabelOcrJob(jobId).catch(() => undefined);
		activeJobId = "";
		scanning = false;
		uploadProgress = null;
		progressStatus = "";
	};

	const scanPhoto = async () => {
		if (!photo || scanning || mappings.length === 0) return;
		clearScan();
		scanning = true;
		progressStatus = "Preparing the label image…";
		abortController = new AbortController();
		try {
			const completed = await runJob({
				file: photo,
				crop,
				signal: abortController.signal,
				onPrepared: () => {
					progressStatus = "Uploading the prepared label…";
				},
				onJobId: (jobId) => {
					activeJobId = jobId;
				},
				onStatus: readStatus,
				onUploadProgress: (nextProgress) => {
					uploadProgress = nextProgress;
				},
			});
			result = completed.result;
			selected = [
				...(result.serving ? [servingOptionId] : []),
				...result.candidates.map((candidate) => candidate.nutrientId),
				...result.qualitativeFacts.map((fact) =>
					qualitativeOptionId(fact.nutrientId),
				),
			];
			if (selected.length === 0) {
				error =
					"No safe nutrition values were found. Enter the label values manually.";
			}
		} catch (scanError) {
			if (
				scanError instanceof DOMException &&
				scanError.name === "TimeoutError"
			) {
				error =
					"The label scan took too long and was stopped. Adjust the crop or enter the values manually.";
			} else if (!(
				scanError instanceof DOMException && scanError.name === "AbortError"
			)) {
				error =
					"The label could not be read. Try a clearer, straight-on photo or enter the values manually.";
			}
		} finally {
			scanning = false;
			abortController = null;
			activeJobId = "";
			uploadProgress = null;
			progressStatus = "";
		}
	};

	$effect(() => {
		const selectedPhoto = photo;
		if (!selectedPhoto) {
			previewUrl = "";
			return;
		}
		const nextUrl = URL.createObjectURL(selectedPhoto);
		previewUrl = nextUrl;
		return () => URL.revokeObjectURL(nextUrl);
	});

	const applySelected = () => {
		if (!result) return;
		const selectedNutrientIds = new Set(
			selected.filter((value): value is number => typeof value === "number"),
		);
		onApply({
			candidates: result.candidates.filter((candidate) =>
				selectedNutrientIds.has(candidate.nutrientId),
			),
			qualitativeFacts: result.qualitativeFacts.filter((fact) =>
				selected.includes(qualitativeOptionId(fact.nutrientId)),
			),
			serving: selected.includes(servingOptionId) ? result.serving : null,
		});
		appliedMessage =
			"Selected label values were added. Review them before continuing.";
	};

	onDestroy(() => {
		const jobId = activeJobId;
		abortController?.abort();
		if (jobId) void cancelNutritionLabelOcrJob(jobId).catch(() => undefined);
	});
</script>

<section
	class="nutrition-label-ocr"
	aria-labelledby="nutrition-label-ocr-title"
>
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
	{#if previewUrl}
		<div class="nutrition-label-ocr__crop" aria-label="Nutrition label crop">
			<div class="nutrition-label-ocr__crop-preview">
				<img src={previewUrl} alt="Selected nutrition label crop preview" />
				<div
					class="nutrition-label-ocr__crop-frame"
					style={`left:${cropLeft}%;top:${cropTop}%;width:${cropRight - cropLeft}%;height:${cropBottom - cropTop}%`}
				></div>
			</div>
			<p>
				Move the four edges around the nutrition facts panel before reading.
			</p>
			<div class="nutrition-label-ocr__crop-controls">
				<label>
					<span>Left edge</span>
					<input
						type="range"
						min="0"
						max={cropRight - 10}
						bind:value={cropLeft}
					/>
				</label>
				<label>
					<span>Right edge</span>
					<input
						type="range"
						min={cropLeft + 10}
						max="100"
						bind:value={cropRight}
					/>
				</label>
				<label>
					<span>Top edge</span>
					<input
						type="range"
						min="0"
						max={cropBottom - 10}
						bind:value={cropTop}
					/>
				</label>
				<label>
					<span>Bottom edge</span>
					<input
						type="range"
						min={cropTop + 10}
						max="100"
						bind:value={cropBottom}
					/>
				</label>
			</div>
		</div>
	{/if}

	{#if scanning}
		<RoundedActionButton variant="neutral" onclick={stopScan}>
			Stop label scan
		</RoundedActionButton>
	{:else}
		<RoundedActionButton
			onclick={scanPhoto}
			disabled={!photo || mappings.length === 0}
		>
			Read label
		</RoundedActionButton>
	{/if}

	{#if scanning}
		<div
			class="nutrition-label-ocr__progress"
			aria-live="polite"
			aria-busy="true"
		>
			{#if uploadProgress === null}
				<progress></progress>
			{:else}
				<progress max="1" value={uploadProgress}></progress>
			{/if}
			<span>{progressStatus || "Preparing label scan…"}</span>
		</div>
	{/if}

	{#if result && options.length > 0}
		<fieldset class="nutrition-label-ocr__review">
			<legend>Review suggestions</legend>
			<p>Uncheck anything that does not match the package label.</p>
			<CheckboxGroup
				{options}
				{selected}
				onChange={(values) => (selected = values)}
			/>
		</fieldset>
		<RoundedActionButton
			onclick={applySelected}
			disabled={selected.length === 0}
		>
			Use selected values
		</RoundedActionButton>
	{/if}

	{#if error}
		<StatusMessage tone="danger" title="Label scan needs attention"
			>{error}</StatusMessage
		>
	{/if}
	{#if appliedMessage}
		<StatusMessage tone="success" title="Suggestions applied"
			>{appliedMessage}</StatusMessage
		>
	{/if}
</section>

<style lang="scss">
	@use "./NutritionLabelOcrInput.scss";
</style>
