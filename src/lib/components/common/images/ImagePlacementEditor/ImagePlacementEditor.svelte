<script lang="ts">
	import PillButton from "$lib/components/common/buttons/PillButton/PillButton.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import ImagePlacementCardPreview from "$lib/components/common/images/ImagePlacementCardPreview/ImagePlacementCardPreview.svelte";
	import type { ImagePlacementEditorProps } from "./types";
	import {
		createCustomImagePlacement,
		createFillImagePlacement,
		createFullImagePlacement,
		EMPTY_IMAGE_PLACEMENT_GEOMETRY,
		IMAGE_PLACEMENT_MAX_ZOOM,
	} from "$lib/utils/food/images/imagePlacement";
	import type {
		ImageFitMode,
		ImagePlacementGeometry,
		ImagePlacementValue,
	} from "$lib/utils/food/images/types";

	let {
		imageUrl,
		alt,
		value,
		foodName = "Product name",
		brandName = "",
		category = "Ingredient category",
		title = "Image placement",
		description = "Adjust how the image appears in ingredient cards.",
		editable = true,
		showWarningEdge = false,
		smartPlacementSource = imageUrl,
		onChange,
	}: ImagePlacementEditorProps = $props();

	const editorId = $props.id();
	const instructionsId = `${editorId}-instructions`;
	let previewGeometry = $state<ImagePlacementGeometry>({
		...EMPTY_IMAGE_PLACEMENT_GEOMETRY,
	});
	let suggestingPlacement = $state(false);
	let suggestionProgress = $state(0);
	let suggestionMessage = $state("");
	let suggestionError = $state("");
	const activeFitMode = $derived<ImageFitMode>(
		value.placementVersion <= 1 ? "custom" : value.fitMode,
	);

	const updateCustomValue = (patch: Partial<ImagePlacementValue>) => {
		onChange?.({
			...createCustomImagePlacement(value, previewGeometry.effectiveZoom),
			...patch,
			fitMode: "custom",
		});
	};

	const selectFitMode = (fitMode: Exclude<ImageFitMode, "custom">) => {
		if (fitMode === "contain") {
			onChange?.(createFullImagePlacement());
			return;
		}
		onChange?.(createFillImagePlacement(previewGeometry.coverZoom));
	};

	const formatZoom = (zoom: number) => `${zoom.toFixed(2).replace(/\.00$/, "")}×`;
	const clearSuggestionFeedback = () => {
		suggestionMessage = "";
		suggestionError = "";
	};
	const restoreDefault = () => {
		clearSuggestionFeedback();
		onChange?.(createFullImagePlacement());
	};
	const suggestPlacement = async () => {
		if (!previewGeometry.ready || suggestingPlacement) return;
		suggestingPlacement = true;
		suggestionProgress = 0;
		clearSuggestionFeedback();

		try {
			const { suggestImagePlacement } = await import(
				"$lib/utils/food/images/smartImagePlacement.client"
			);
			const suggestion = await suggestImagePlacement({
				image: smartPlacementSource,
				geometry: previewGeometry,
				productName: foodName,
				brandName,
				onProgress: ({ progress }) => {
					suggestionProgress = progress;
				},
			});
			if (!suggestion) {
				suggestionError =
					"No likely front-label product text was found. The current placement was not changed.";
				return;
			}
			onChange?.(suggestion.placement);
			suggestionMessage =
				"Smart placement was applied to the preview. Adjust it or restore the default before saving.";
		} catch (error) {
			suggestionError =
				error instanceof Error
					? error.message
					: "Smart placement could not analyze this image.";
		} finally {
			suggestingPlacement = false;
		}
	};
</script>

<section class="image-placement-editor" aria-label={title}>
	<div class="image-placement-editor__copy">
		<strong class="image-placement-editor__title">
			<span>{title}</span>
		</strong>
		{#if description}
			<p>{description}</p>
		{/if}
	</div>

	<div class="image-placement-editor__editing-preview">
		<ImagePlacementCardPreview
			{imageUrl}
			{alt}
			{value}
			{foodName}
			{category}
			ariaLabel="Interactive card image preview"
			{showWarningEdge}
			interactive={editable}
			{instructionsId}
			onChange={(nextValue) => onChange?.(nextValue)}
			onGeometryChange={(geometry) => (previewGeometry = geometry)}
		/>
		{#if editable}
			<p id={instructionsId}>
				Drag to reposition. Pinch or scroll over the preview to zoom.
			</p>
		{/if}
	</div>

	{#if editable}
		<div class="image-placement-editor__controls">
			<RoundedActionButton
				variant="soft"
				fullWidth
				busy={suggestingPlacement}
				disabled={!previewGeometry.ready}
				onclick={suggestPlacement}
			>
				{suggestingPlacement
					? `Finding product text ${Math.round(suggestionProgress * 100)}%`
					: "Suggest placement"}
			</RoundedActionButton>
			{#if suggestionMessage || suggestionError}
				<div
					class="image-placement-editor__suggestion-status"
					aria-live="polite"
				>
					{#if suggestionMessage}
						<p>{suggestionMessage}</p>
					{/if}
					{#if suggestionError}
						<p class="image-placement-editor__suggestion-error">
							{suggestionError}
						</p>
					{/if}
				</div>
			{/if}
			<div class="image-placement-editor__presets" role="group" aria-label="Image fit">
				<PillButton
					pressed={activeFitMode === "contain"}
					variant={activeFitMode === "contain" ? "primary" : "neutral"}
					onclick={() => {
						clearSuggestionFeedback();
						selectFitMode("contain");
					}}
				>
					Full image
				</PillButton>
				<PillButton
					pressed={activeFitMode === "cover"}
					variant={activeFitMode === "cover" ? "primary" : "neutral"}
					disabled={!previewGeometry.ready}
					onclick={() => {
						clearSuggestionFeedback();
						selectFitMode("cover");
					}}
				>
					Fill card
				</PillButton>
			</div>
			<label>
				<span>
					Horizontal position
					{#if !previewGeometry.canMoveX}<small>Centered at this zoom</small>{/if}
				</span>
				<input
					type="range"
					min="0"
					max="100"
					step="1"
					value={value.cropX}
					disabled={!previewGeometry.canMoveX}
					oninput={(event) =>
						updateCustomValue({ cropX: Number(event.currentTarget.value) })}
				/>
			</label>
			<label>
				<span>
					Vertical position
					{#if !previewGeometry.canMoveY}<small>Centered at this zoom</small>{/if}
				</span>
				<input
					type="range"
					min="0"
					max="100"
					step="1"
					value={value.cropY}
					disabled={!previewGeometry.canMoveY}
					oninput={(event) =>
						updateCustomValue({ cropY: Number(event.currentTarget.value) })}
				/>
			</label>
			<label>
				<span>Zoom <output>{formatZoom(previewGeometry.effectiveZoom)}</output></span>
				<input
					type="range"
					min="1"
					max={IMAGE_PLACEMENT_MAX_ZOOM}
					step="0.05"
					value={previewGeometry.effectiveZoom}
					oninput={(event) =>
						updateCustomValue({ cropZoom: Number(event.currentTarget.value) })}
				/>
			</label>
			<RoundedActionButton variant="neutral" onclick={restoreDefault}>
				Restore default
			</RoundedActionButton>
		</div>
	{/if}
</section>

<style lang="scss">
	@use "./ImagePlacementEditor.scss";
</style>
